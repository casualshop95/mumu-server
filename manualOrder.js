// manualOrder.js
//
// Accepts orders submitted from manual-order-form.html (a simple mobile
// form Vitalii can open from anywhere) and pushes them straight into the
// same print queue Andrea (the voice agent) uses — bypassing Loyverse
// entirely for this path. No coментарі/notes workaround needed: the form
// sends exactly the fields termux-print-agent.js expects.
//
// Setup:
//   1. In Railway, add an env var: MANUAL_ORDER_TOKEN=<a random token>
//   2. In manual-order-form.html, set TOKEN to that same value.
//   3. In index.js, near your other app.use(...) calls:
//        const manualOrderRouter = require('./manualOrder');
//        app.use(manualOrderRouter);

const express = require('express');
const router = express.Router();

let enqueue;
try {
  enqueue = require('./printQueue').enqueue;
} catch (e) {
  console.warn('[manualOrder] Could not load printQueue.enqueue — ' +
    'orders will only be logged, not printed, until this is wired up.');
}

router.options('/manual-order', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/manual-order', express.json(), (req, res) => {
  // Allow the form to be opened from anywhere (a local file, a phone
  // browser, etc.) and still reach this endpoint — without these headers
  // the browser blocks the request as a CORS violation before it even
  // reaches our token check below.
  res.header('Access-Control-Allow-Origin', '*');

  const token = req.query.token;
  if (!token || token !== process.env.MANUAL_ORDER_TOKEN) {
    console.warn('[manualOrder] Rejected request with invalid/missing token');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body || {};

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item' });
  }

  // Field names match termux-print-agent.js's buildTicket(order) exactly —
  // no translation layer needed, unlike the Loyverse webhook path.
  const order = {
    source: 'manual_form',
    service_type: body.service_type === 'delivery' ? 'delivery' : 'pickup',
    payment_method: body.payment_method === 'card' ? 'card' : 'cash',
    total: typeof body.total === 'number' ? body.total : Number(body.total) || 0,
    customer_name: body.customer_name || null,
    customer_phone: body.customer_phone || null,
    delivery_address: body.delivery_address || null,
    delivery_notes: body.delivery_notes || null,
    cash_amount: typeof body.cash_amount === 'number' ? body.cash_amount : undefined,
    items: body.items.map(item => ({
      name: item.name,
      quantity: Number(item.quantity) || 1,
      modifications: Array.isArray(item.modifications) ? item.modifications : [],
      extras: Array.isArray(item.extras) ? item.extras : [],
    })),
  };

  console.log('[manualOrder] Queuing order for printing:', JSON.stringify(order));

  if (enqueue) {
    enqueue(order);
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
