// publicOrder.js
//
// Public-facing order endpoint for customers ordering over the internet
// (no token — anyone with the link can use it). Unlike manualOrder.js
// (Vitalii's own trusted tool), this endpoint NEVER trusts a client-sent
// total: it recomputes subtotal/delivery_fee/total itself via
// calculateTotal.js — the same pricing logic Andrea (the voice agent)
// uses — so a tampered browser request can't under-charge an order.
//
// Setup:
//   In index.js, near your other app.use(...) calls:
//     const publicOrderRouter = require('./publicOrder');
//     app.use(publicOrderRouter);
//
//   No new env var needed — this reuses LOYVERSE_ACCESS_TOKEN, already set.

const express = require('express');
const router = express.Router();
const { calculateTotal } = require('./calculateTotal');
const { createLoyverseReceipt } = require('./loyverseClient');
const { checkHours } = require('./hours');

let enqueue;
try {
  enqueue = require('./printQueue').enqueue;
} catch (e) {
  console.warn('[publicOrder] Could not load printQueue.enqueue — ' +
    'orders will only be logged, not printed, until this is wired up.');
}

// --- Basic abuse protection ---
// No secret token here (the page is public), so instead we rate-limit by
// IP: at most MAX_REQUESTS submissions per WINDOW_MS. In-memory only —
// resets on server restart, which is fine for deterring casual abuse; it
// is not meant to stop a determined attacker.
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 8;
const requestLog = new Map(); // ip -> array of timestamps

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

// --- Duplicate submission protection ---
// The form sends a random order_id with every submission. A double-tap or
// a browser retry after a flaky connection resends the exact same
// order_id — we recognize that and reply with the original result instead
// of queuing/printing/charging the order a second time.
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const seenOrders = new Map(); // order_id -> { timestamp, response }

function cleanupSeenOrders() {
  const now = Date.now();
  for (const [id, entry] of seenOrders) {
    if (now - entry.timestamp > DEDUPE_WINDOW_MS) seenOrders.delete(id);
  }
}

router.options('/public-order', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

router.post('/public-order', express.json(), async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    console.warn(`[publicOrder] Rate limit hit for ${ip}`);
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Demasiados pedidos seguidos. Inténtalo en unos minutos.' });
  }

  const body = req.body || {};

  cleanupSeenOrders();
  if (body.order_id && seenOrders.has(body.order_id)) {
    console.log(`[publicOrder] Duplicate submission of order_id ${body.order_id} — replaying original response, not re-queuing`);
    const cached = seenOrders.get(body.order_id).response;
    return res.status(200).json(cached);
  }

  const hours = checkHours();
  if (!hours.is_open) {
    console.log(`[publicOrder] Rejected order — restaurant closed (${hours.current_time || '?'}, ${hours.day_of_week || '?'})`);
    return res.status(400).json({
      error: 'CLOSED',
      message: hours.hours_today
        ? `Ahora mismo estamos cerrados. Horario de hoy: ${hours.hours_today}`
        : 'Ahora mismo estamos cerrados.',
    });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'NO_ITEMS', message: 'El pedido no contiene artículos.' });
  }
  if (!body.customer_name || !String(body.customer_name).trim()) {
    return res.status(400).json({ error: 'MISSING_NAME', message: 'Falta el nombre del cliente.' });
  }
  if (!body.customer_phone || !String(body.customer_phone).trim()) {
    return res.status(400).json({ error: 'MISSING_PHONE', message: 'Falta el teléfono del cliente.' });
  }
  const serviceType = body.service_type === 'pickup' ? 'pickup' : 'delivery';
  if (serviceType === 'delivery' && (!body.delivery_address || !String(body.delivery_address).trim())) {
    return res.status(400).json({ error: 'MISSING_ADDRESS', message: 'Falta la dirección de entrega.' });
  }

  // Authoritative pricing — ignores any total the client may have sent.
  const priced = calculateTotal({ service_type: serviceType, items: body.items });

  if (priced.error) {
    console.warn('[publicOrder] Pricing failed:', JSON.stringify(priced));
    return res.status(400).json({
      error: priced.error,
      message: priced.message || 'No se pudo calcular el pedido.',
      unknown_items: priced.unknown_items,
      unknown_extras: priced.unknown_extras,
    });
  }
  if ((priced.unknown_items && priced.unknown_items.length > 0) ||
      (priced.unknown_extras && priced.unknown_extras.length > 0)) {
    console.warn('[publicOrder] Order has unrecognized items/extras:', JSON.stringify(priced));
    return res.status(400).json({
      error: 'UNKNOWN_ITEMS',
      message: 'Algunos productos no se han reconocido. Por favor, revisa el pedido.',
      unknown_items: priced.unknown_items,
      unknown_extras: priced.unknown_extras,
    });
  }

  const paymentMethod = body.payment_method === 'card' ? 'card' : 'cash';

  // Rebuild items in the shape printQueue/loyverseClient expect, using
  // calculateTotal's own resolved lines — display text for extras/mods
  // comes from what the customer typed, prices/validity are server-checked.
  const items = priced.lines.map(line => ({
    name: line.name,
    quantity: line.quantity,
    modifications: line.modifications.map(m => m.name),
    extras: line.extras.map(e => e.name),
  }));

  const order = {
    source: 'public_form',
    service_type: serviceType,
    payment_method: paymentMethod,
    total: priced.total,
    delivery_fee: priced.delivery_fee,
    customer_name: String(body.customer_name).trim(),
    customer_phone: String(body.customer_phone).trim(),
    delivery_address: body.delivery_address ? String(body.delivery_address).trim() : null,
    delivery_notes: body.delivery_notes ? String(body.delivery_notes).trim() : null,
    items,
  };

  console.log('[publicOrder] Queuing order for printing:', JSON.stringify(order));

  if (enqueue) {
    enqueue(order);
  }

  // Let the customer know their order was received and the confirmed total
  // (which may legitimately differ from whatever they saw client-side, if
  // their browser's local calculation was out of date or tampered with).
  const responsePayload = { ok: true, total: priced.total, delivery_fee: priced.delivery_fee };
  if (body.order_id) {
    seenOrders.set(body.order_id, { timestamp: Date.now(), response: responsePayload });
  }
  res.status(200).json(responsePayload);

  // Fire-and-forget: register the sale in Loyverse for bookkeeping.
  const accessToken = process.env.LOYVERSE_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('[publicOrder] LOYVERSE_ACCESS_TOKEN not set — skipping Loyverse receipt creation');
    return;
  }

  createLoyverseReceipt(order, accessToken)
    .then(result => {
      if (result.success) {
        console.log('[publicOrder] Loyverse receipt created:', result.receipt.receipt_number);
      } else {
        console.error('[publicOrder] Loyverse receipt creation failed:', JSON.stringify(result));
      }
    })
    .catch(err => {
      console.error('[publicOrder] Loyverse receipt creation threw an error:', err);
    });
});

module.exports = router;
