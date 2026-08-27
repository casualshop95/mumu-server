require('dotenv').config();
const express = require('express');
const { calculateTotal } = require('./calculateTotal');

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

    const result = calculateTotal({
      service_type: params.service_type || 'delivery',
      items: params.items || [],
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
    const order = req.body;
    console.log('Pedido confirmado recibido:', JSON.stringify(order, null, 2));
    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error('Error en /webhook/order-confirmed:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

app.get('/', (req, res) => {
  res.send('MU-MU GRILL order server is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
