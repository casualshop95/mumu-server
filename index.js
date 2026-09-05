require('dotenv').config();
const express = require('express');
const { calculateTotal } = require('./calculateTotal');
const { createLoyverseReceipt } = require('./loyverseClient');
const { parseItemsList } = require('./catalog');
const { enqueue, getPending, markPrinted } = require('./printQueue');
const { isDuplicate } = require('./dedupe');
const { cacheCalculation, getCachedCalculation } = require('./orderCache');

const app = express();
app.use(express.json());

// --- Sistema de carga de cocina (automático + niveles manuales) ---
// Guardamos solo en memoria (se reinicia si el servidor reinicia, lo cual es
// aceptable: en el peor caso, tras un reinicio se necesitan unos pedidos más
// para volver a detectar la alta demanda).
const AUTO_BUSY_THRESHOLD = 6; // nº de pedidos en los últimos 30 min para subir automáticamente a level1
const LOAD_WINDOW_MS = 30 * 60 * 1000;
let recentOrderTimestamps = [];
let manualPauseUntil = 0; // timestamp (ms); 0 = no pausado
let currentLoadLevel = 'normal'; // 'normal' | 'level1' | 'level2', fijado manualmente por el personal

const LOAD_LEVEL_MESSAGES = {
  normal: 'Tiempo de entrega habitual: 40-50 minutos (hasta 1h15 en hora punta).',
  level1: 'Ahora mismo tenemos más pedidos de lo habitual: el tiempo de entrega estimado es de 1 hora a 1 hora y cuarto, pero haremos todo lo posible por servirlo lo antes posible.',
  level2: 'Ahora mismo tenemos mucha demanda: el tiempo de entrega estimado es de 1 hora y cuarto a 1 hora y media, pero haremos todo lo posible por servirlo lo antes posible.',
};

function registerNewOrder() {
  recentOrderTimestamps.push(Date.now());
}

app.get('/tools/check-load', (req, res) => {
  const now = Date.now();
  recentOrderTimestamps = recentOrderTimestamps.filter((t) => now - t <= LOAD_WINDOW_MS);
  const orderCount = recentOrderTimestamps.length;
  const isPaused = now < manualPauseUntil;

  // Si hay mucha demanda automática y nadie ha subido el nivel manualmente,
  // lo subimos a level1 como aviso mínimo — pero nunca bajamos un nivel que
  // el personal haya puesto manualmente más alto (level2).
  let effectiveLevel = currentLoadLevel;
  if (orderCount >= AUTO_BUSY_THRESHOLD && effectiveLevel === 'normal') {
    effectiveLevel = 'level1';
  }

  res.json({
    is_paused: isPaused,
    load_level: effectiveLevel,
    orders_last_30min: orderCount,
    message: LOAD_LEVEL_MESSAGES[effectiveLevel],
  });
});

// Enlaces sencillos para el personal (pensados para guardar como marcador en
// el móvil — abrir el enlace es toda la acción necesaria). Protegidos por una
// clave simple en la variable de entorno ADMIN_SECRET.
app.get('/admin/set-load', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const level = req.query.level;
  if (!['normal', 'level1', 'level2'].includes(level)) {
    return res.status(400).send('Nivel no válido. Usa: normal, level1 o level2.');
  }
  currentLoadLevel = level;
  res.send(`Nivel de carga actualizado a: ${level}\n${LOAD_LEVEL_MESSAGES[level]}`);
});

app.get('/admin/pause', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const minutes = Number(req.query.minutes) || 120;
  manualPauseUntil = Date.now() + minutes * 60000;
  res.send(`Pedidos pausados durante ${minutes} minutos (hasta las ${new Date(manualPauseUntil).toLocaleTimeString('es-ES')}).`);
});

app.get('/admin/resume', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  manualPauseUntil = 0;
  res.send('Pedidos reanudados.');
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/tools/check-hours', (req, res) => {
  try {
    // Interruptor de pruebas: si en Railway se pone la variable de entorno
    // FORCE_OPEN_FOR_TESTING=true, siempre se responde que está abierto,
    // sin tocar el código. Recuerda ponerla en false (o quitarla) antes de
    // pasar a producción real.
    if (process.env.FORCE_OPEN_FOR_TESTING === 'true') {
      return res.json({
        is_open: true,
        current_time: null,
        day_of_week: null,
        hours_today: null,
        note: 'FORCE_OPEN_FOR_TESTING activo',
      });
    }

    const now = new Date();
    const madridStr = now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
    const madridTime = new Date(madridStr);
    const day = madridTime.getDay(); // 0=domingo ... 6=sábado
    const totalMinutes = madridTime.getHours() * 60 + madridTime.getMinutes();

    const isFriSat = day === 5 || day === 6; // viernes o sábado
    const openMinutes = 19 * 60; // 19:00
    const lastOrderMinutes = isFriSat ? 23 * 60 + 15 : 22 * 60 + 45;

    const isOpen = totalMinutes >= openMinutes && totalMinutes <= lastOrderMinutes;

    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const hh = String(madridTime.getHours()).padStart(2, '0');
    const mm = String(madridTime.getMinutes()).padStart(2, '0');

    res.json({
      is_open: isOpen,
      current_time: `${hh}:${mm}`,
      day_of_week: dayNames[day],
      hours_today: isFriSat ? '19:00 - 23:30 (último pedido a las 23:15)' : '19:00 - 23:00 (último pedido a las 22:45)',
    });
  } catch (err) {
    console.error('Error comprobando el horario:', err.message);
    // Ante la duda, mejor asumir que está abierto que rechazar un pedido válido por un fallo técnico.
    res.json({ is_open: true, current_time: null, day_of_week: null, hours_today: null, error: 'CHECK_FAILED' });
  }
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

app.get('/', (req, res) => {
  res.send('MU-MU GRILL order server is running.');
});

// -----------------------------------------------------------------------
// COLA DE IMPRESIÓN LOCAL
//    El agente Termux (en la tablet junto a la impresora) consulta esto
//    periódicamente y envía los tickets pendientes directamente a la
//    impresora por la red local, sin depender de Loyverse.
// -----------------------------------------------------------------------
app.get('/print-queue', (req, res) => {
  res.status(200).json({ jobs: getPending() });
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
});
