require('dotenv').config();
const express = require('express');
const { calculateTotal } = require('./calculateTotal');
const { createLoyverseReceipt } = require('./loyverseClient');
const { parseItemsList } = require('./catalog');
const { enqueue, getPending, markPrinted } = require('./printQueue');

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
