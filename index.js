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

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
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

    // Protección 3: si hay un cálculo verificado reciente de calculate_total
    // para este teléfono, lo usamos como fuente de verdad para items/total —
    // así una reconstrucción inconsistente en esta llamada (duplicar líneas,
    // perder un extra, etc.) no cambia lo que ya se le confirmó al cliente.
    const cached = getCachedCalculation(order.customer_phone);
    if (cached) {
      const cachedItems = (cached.lines || []).map((line) => ({
        name: line.name,
        quantity: line.quantity,
        modifications: line.modifications || [],
        extras: (line.extras || []).map((e) => e.name),
      }));
      const itemsMatch = JSON.stringify(cachedItems) === JSON.stringify(order.items);
      const totalMatch = Number(cached.total) === Number(order.total);
      if (!itemsMatch || !totalMatch) {
        console.warn('El pedido recibido no coincide con el último calculate_total verificado — usando los datos verificados en su lugar.');
      }
      order.items = cachedItems;
      order.total = cached.total;
      order.delivery_fee = cached.delivery_fee;
    }

    // Protección 1: si items llega vacío, es casi seguro una llamada incompleta
    // (streaming a medio terminar) — la rechazamos sin encolar nada ni tocar Loyverse.
    if (!Array.isArray(order.items) || order.items.length === 0) {
      console.warn('Pedido descartado: items vacío (posible llamada incompleta/streaming).');
      return res.status(200).json({ success: false, error: 'EMPTY_ITEMS_IGNORED' });
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
