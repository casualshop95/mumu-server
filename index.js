require('dotenv').config();
const express = require('express');
const { calculateTotal } = require('./calculateTotal');
const { createLoyverseReceipt } = require('./loyverseClient');
const { parseItemsList } = require('./catalog');
const { enqueue, getPending, markPrinted } = require('./printQueue');
const { isDuplicate } = require('./dedupe');
const { cacheCalculation, getCachedCalculation } = require('./orderCache');
const { checkHours } = require('./hours');
const monitor = require('./monitor');

const app = express();
app.use(express.json());
app.use(express.static('public'));
const manualOrderRouter = require('./manualOrder');
app.use(manualOrderRouter);
const publicOrderRouter = require('./publicOrder');
app.use(publicOrderRouter);

// --- Sistema de carga de cocina (automático + niveles manuales) ---
// El estado vive en loadState.js (compartido con la web pública).
const loadState = require('./loadState');
const registerNewOrder = loadState.registerNewOrder;

app.get('/tools/check-load', (req, res) => {
  const s = loadState.getStatus();
  res.json({
    is_paused: s.is_paused,
    load_level: s.load_level,
    orders_last_30min: s.orders_last_30min,
    delivery_message: s.delivery_message,
    pickup_message: s.pickup_message,
  });
});

// Estado público para las páginas web (tiempos estimados y pausa). Sin datos sensibles.
app.get('/public/status', (req, res) => {
  const s = loadState.getStatus();
  res.set('Cache-Control', 'no-store');
  res.json({
    is_paused: s.is_paused,
    busy: s.busy,
    delivery_time: s.delivery_time,
    pickup_time: s.pickup_time,
  });
});

// Enlaces sencillos para el personal (guardar como marcador en el móvil).
// Protegidos por la variable de entorno ADMIN_SECRET.
app.get('/admin/set-load', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const level = req.query.level;
  if (!loadState.setLevel(level)) {
    return res.status(400).send('Nivel no válido. Usa: normal, level1 o level2.');
  }
  const m = loadState.LOAD_LEVEL_MESSAGES[level];
  const exp = loadState.levelExpiry();
  const aviso = exp ? `\nVolverá a "normal" automáticamente al cerrar (${new Date(exp).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}).` : '';
  res.send(`Nivel de carga actualizado a: ${level}\n${m.delivery}\n${m.pickup}${aviso}`);
});

app.get('/admin/pause', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const minutes = Number(req.query.minutes) || 120;
  const until = loadState.pause(minutes);
  res.send(`Pedidos pausados (voz y web) durante ${minutes} minutos (hasta las ${new Date(until).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })}).`);
});

app.get('/admin/resume', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  loadState.resume();
  res.send('Pedidos reanudados.');
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/tools/check-hours', (req, res) => {
  res.json(checkHours());
});

app.post('/tools/calculate-total', (req, res) => {
  try {
    console.log('=== ДАНІ ВІД HAPP AI ===');
    console.log(JSON.stringify(req.body, null, 2));

    const params = req.body.parameters || req.body.arguments || req.body.args || req.body;
    const items = parseItemsList(params.items || []);

    console.log('=== ITEMS PARSEADOS ===');
    console.log(JSON.stringify(items, null, 2));

    const result = calculateTotal({
      service_type: params.service_type || 'delivery',
      items,
    });

    console.log('=== РЕЗУЛЬТАТ РОЗРАХУНКУ ===');
    console.log(JSON.stringify(result, null, 2));

    // Si el cálculo fue exitoso (sin artículos desconocidos) y tenemos un
    // teléfono, lo guardamos como fuente de verdad para create_order — así
    // evitamos que una reconstrucción inconsistente del pedido en la llamada
    // posterior cambie lo que ya se le confirmó al cliente.
    if (!result.error && (!result.unknown_items || result.unknown_items.length === 0) && params.customer_phone) {
      cacheCalculation(params.customer_phone, {
        service_type: params.service_type || 'delivery',
        lines: result.lines,
        total: result.total,
        delivery_fee: result.delivery_fee,
      });
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Помилка в /tools/calculate-total:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/webhook/order-confirmed', async (req, res) => {
  try {
    const order = req.body.parameters || req.body.arguments || req.body.args || req.body;
    order.items = parseItemsList(order.items || []);

    console.log('=== ПІДТВЕРДЖЕНЕ ЗАМОВЛЕННЯ (parsed) ===');
    console.log(JSON.stringify(order, null, 2));

    // Protección 3: si create_order llega con items VACÍOS (llamada incompleta/streaming),
    // usamos el último calculate_total verificado para este teléfono como red de
    // seguridad. NUNCA sobrescribimos datos que create_order sí trae completos —
    // el cliente puede haber corregido el pedido después de aquel cálculo, y en
    // ese caso create_order es la fuente más reciente y correcta, no el caché.
    const cached = getCachedCalculation(order.customer_phone);
    if (cached && (!Array.isArray(order.items) || order.items.length === 0)) {
      console.warn('items vacío en create_order — usando el último calculate_total verificado como red de seguridad.');
      order.items = (cached.lines || []).map((line) => ({
        name: line.name,
        quantity: line.quantity,
        modifications: line.modifications || [],
        extras: (line.extras || []).map((e) => e.name),
      }));
      order.total = cached.total;
      order.delivery_fee = cached.delivery_fee;
    }

    // Protección 1: si items llega vacío, es casi seguro una llamada incompleta
    // (streaming a medio terminar) — la rechazamos sin encolar nada ni tocar Loyverse.
    if (!Array.isArray(order.items) || order.items.length === 0) {
      console.warn('Pedido descartado: items vacío (posible llamada incompleta/streaming).');
      return res.status(200).json({ success: false, error: 'EMPTY_ITEMS_IGNORED' });
    }

    // Protección 4: recalculamos el total AQUÍ MISMO a partir de los items que
    // realmente trae este create_order — nunca confiamos en el número que diga
    // el agente (ni en un cálculo cacheado de una llamada anterior, que puede
    // haber quedado obsoleto si el pedido cambió después). Así el total del
    // ticket y de Loyverse siempre coincide matemáticamente con los artículos
    // que se están registrando de verdad.
    const freshCalc = calculateTotal({ service_type: order.service_type, items: order.items });
    if (!freshCalc.error) {
      if (order.total !== undefined && Number(freshCalc.total) !== Number(order.total)) {
        console.warn(`El total recibido (${order.total}) no coincide con el recalculado a partir de los items (${freshCalc.total}) — usando el recalculado.`);
      }
      order.total = freshCalc.total;
      order.delivery_fee = freshCalc.delivery_fee;
    } else {
      console.warn('No se pudo recalcular el total (artículos no reconocidos) — se mantiene el total recibido como último recurso.');
    }

    // Protección 2: si un pedido con el mismo teléfono + mismo total ya se procesó
    // hace pocos segundos, es casi seguro la misma llamada disparada varias veces
    // (visto con Retell: 2-3 llamadas en menos de 30ms con datos parciales distintos).
    if (isDuplicate(order)) {
      console.warn('Pedido descartado: duplicado detectado en los últimos 20s.', JSON.stringify(order));
      return res.status(200).json({ success: false, error: 'DUPLICATE_ORDER_IGNORED' });
    }

    // Encolamos el ticket de cocina SIEMPRE, incluso si Loyverse falla después —
    // la cocina necesita el pedido físico independientemente de la contabilidad.
    const printJob = enqueue(order);
    console.log(`Ticket #${printJob.id} añadido a la cola de impresión.`);

    const accessToken = process.env.LOYVERSE_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Falta LOYVERSE_ACCESS_TOKEN en las variables de entorno.');
      return res.status(200).json({ success: false, error: 'MISSING_LOYVERSE_TOKEN' });
    }

    const result = await createLoyverseReceipt(order, accessToken);

    if (!result.success) {
      console.error('Error creando el recibo en Loyverse:', result);
      return res.status(200).json({ success: false, ...result });
    }

    console.log('Recibo creado en Loyverse:', result.receipt.receipt_number);
    registerNewOrder();
    return res.status(200).json({
      success: true,
      receipt_number: result.receipt.receipt_number,
      unmatched_items: result.notFound || [],
    });
  } catch (err) {
    console.error('Error en /webhook/order-confirmed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Página principal: según el dominio se muestra la carta de cada marca.
// (HOT SPOT: añadir aquí su dominio cuando esté comprado)
const PIZZA_HOSTS = ['hotspotpizza.es', 'www.hotspotpizza.es'];
app.get('/favicon.ico', (req, res) => {
  const host = String(req.hostname || '').toLowerCase();
  const icon = PIZZA_HOSTS.includes(host) ? 'fav-hotspot.ico' : 'fav-mumu.ico';
  res.sendFile('images/' + icon, { root: 'public' });
});

app.get('/', (req, res) => {
  const host = String(req.hostname || '').toLowerCase();
  const page = PIZZA_HOSTS.includes(host) ? 'pizza-order.html' : 'public-order.html';
  res.sendFile(page, { root: 'public' });
});

// -----------------------------------------------------------------------
// COLA DE IMPRESIÓN LOCAL
//    El agente Termux (en la tablet junto a la impresora) consulta esto
//    periódicamente y envía los tickets pendientes directamente a la
//    impresora por la red local, sin depender de Loyverse.
// -----------------------------------------------------------------------
app.get('/print-queue', (req, res) => {
  monitor.touchPoll(); // la consulta del agente sirve de "latido"
  res.status(200).json({ jobs: getPending() });
});

// Estado para el personal (enlace para guardar como marcador).
app.get('/admin/status', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  res.json(monitor.status(getPending));
});

// Prueba del aviso: abre /admin/test-telegram?key=... y debe llegarte un mensaje.
app.get('/admin/test-telegram', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const ok = await monitor.notify('✅ Prueba: los avisos de MU-MU GRILL funcionan.');
  res.send(ok ? 'Enviado. Mira Telegram.' : 'No se pudo enviar. Revisa TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Railway.');
});

app.post('/print-queue/:id/ack', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const found = markPrinted(id);
  res.status(200).json({ success: found });
});

// Запускаємо сервер ТІЛЬКИ ОДИН РАЗ на порту з process.env.PORT або 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  monitor.startWatchdog(getPending);
});
