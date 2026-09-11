// manualOrder.js
//
// Accepts orders submitted from manual-order-form.html (a simple mobile
// form Vitalii can open from anywhere) and:
//   1. pushes them straight into the same print queue Andrea (the voice
//      agent) uses — kitchen printing, independent of Loyverse;
//   2. also creates a matching receipt in Loyverse via the same
//      loyverseClient.js/loyverseCatalog.js logic Andrea's create_order
//      already uses, purely for sales record-keeping. This does NOT
//      cause a second print — Loyverse-side printing was only ever a risk
//      via the loyverseWebhook.js path, which has been removed.
//
// Setup:
//   1. In Railway, add env vars:
//        MANUAL_ORDER_TOKEN=<a random token>
//        LOYVERSE_ACCESS_TOKEN=<same token Andrea's create_order already uses>
//   2. In manual-order-form.html, set TOKEN to the MANUAL_ORDER_TOKEN value.
//   3. In index.js, near your other app.use(...) calls:
//        const manualOrderRouter = require('./manualOrder');
//        app.use(manualOrderRouter);

const express = require('express');
const router = express.Router();
const { createLoyverseReceipt } = require('./loyverseClient');

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
  // no translation layer needed, unlike the old Loyverse webhook path.
  const order = {
    source: 'manual_form',
    service_type: body.service_type === 'delivery' ? 'delivery' : 'pickup',
    payment_method: body.payment_method === 'card' ? 'card' : 'cash',
    total: typeof body.total === 'number' ? body.total : Number(body.total) || 0,
    delivery_fee: typeof body.delivery_fee === 'number' ? body.delivery_fee : Number(body.delivery_fee) || 0,
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

  // Respond right away — the kitchen ticket must never wait on the
  // Loyverse API call below.
  res.status(200).json({ ok: true });

  // Fire-and-forget: register the sale in Loyverse for bookkeeping only.
  const accessToken = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('[manualOrder] LOYVERSE_ACCESS_TOKEN not set — skipping Loyverse receipt creation');
    return;
  }

  createLoyverseReceipt(order, accessToken)
    .then(result => {
      if (result.success) {
        console.log('[manualOrder] Loyverse receipt created:', result.receipt.receipt_number);
        if (result.notFound && result.notFound.length > 0) {
          console.warn('[manualOrder] Some items were not recognized by Loyverse catalog:', result.notFound);
        }
      } else {
        console.error('[manualOrder] Loyverse receipt creation failed:', JSON.stringify(result));
      }
    })
    .catch(err => {
      console.error('[manualOrder] Loyverse receipt creation threw an error:', err);
    });
});

module.exports = router;
