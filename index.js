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
    // 1. ВИВЕДЕМО В ЛОГИ ТЕ, ЩО ПРИСЛАВ HAPP AI
    console.log('=== ДАНІ ВІД HAPP AI ===');
    console.log(JSON.stringify(req.body, null, 2));

    const params = req.body.parameters || req.body.arguments || req.body.args || req.body;[cite: 3]

    // 2. РАХУЄМО СУМУ
    const result = calculateTotal({
      service_type: params.service_type || 'delivery',[cite: 1]
      items: params.items || [],[cite: 1]
    });

    // 3. ВИВЕДЕМО В ЛОГИ РЕЗУЛЬТАТ РОЗРАХУНКУ
    console.log('=== РЕЗУЛЬТАТ РОЗРАХУНКУ ===');
    console.log(JSON.stringify(result, null, 2));

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Помилка в /tools/calculate-total:', err);[cite: 3]
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('MU-MU GRILL order server is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
