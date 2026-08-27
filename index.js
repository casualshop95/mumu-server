// index.js
require('dotenv').config();
const express = require('express');
const { calculateTotal } = require('./calculateTotal');

const app = express();
app.use(express.json());

// Log simple de cada petición — útil para depurar durante el piloto
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// -----------------------------------------------------------------------
// 1) ENDPOINT PARA EL TOOL "calculate_total" DE HAPP
//    URL a pegar en "Посилання на API": https://TU-DOMINIO/tools/calculate-total
// -----------------------------------------------------------------------
app.post('/tools/calculate-total', (req, res) => {
  try {
    // Happ puede enviar los parámetros directamente en el body, o anidados
    // bajo una clave como "parameters" o "arguments" según su formato de tool call.
    // Soportamos ambos casos:
    const params = req.body.parameters || req.body.arguments || req.body;

    const result = calculateTotal({
      service_type: params.service_type,
      items: params.items,
    });

    if (result.error) {
      return res.status(200).json({
        success: false,
        error: result.error,
        message: result.message,
        unknown_items: result.unknown_items || [],
      });
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Error en /tools/calculate-total:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

// -----------------------------------------------------------------------
// 2) ENDPOINT PARA RECIBIR EL PEDIDO CONFIRMADO Y ENVIARLO A LOYVERSE
//    Esto es un ESQUELETO — falta mapear los nombres del menú a los IDs
//    reales de los artículos en tu cuenta de Loyverse (ver README.md).
// -----------------------------------------------------------------------
app.post('/webhook/order-confirmed', async (req, res) => {
  try {
    const order = req.body;
    console.log('Pedido confirmado recibido:', JSON.stringify(order, null, 2));

    // TODO: aquí se llamaría a la API de Loyverse para crear el recibo/pedido.
    // Ver README.md → sección "Integración con Loyverse" para los pasos pendientes.

    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error('Error en /webhook/order-confirmed:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

// Endpoint de salud, útil para comprobar que el despliegue funciona
app.get('/', (req, res) => {
  res.send('MU-MU GRILL order server is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
