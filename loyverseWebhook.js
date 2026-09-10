// loyverseWebhook.js
//
// Handles incoming webhooks from Loyverse ("Recibo creado o actualizado").
// Lets Vitalii create an order remotely in the Loyverse POS app (from
// anywhere) and have it print automatically on the kitchen printer, the
// same way voice-agent orders already do via printQueue.js.
//
// SECURITY: Loyverse's Back Office UI for webhooks does not expose a
// signing secret, so instead of verifying X-Loyverse-Signature we protect
// this endpoint with a random token passed as a query parameter.
//
// CONFIRMED PAYLOAD SHAPE (from a real test notification, 2026-09-09):
//   {
//     pos_device_id, merchant_id,
//     type: "receipts.update",   // fires on BOTH create and update
//     created_at,
//     receipts: [
//       {
//         receipt_number, note, receipt_type, cancelled_at,
//         source,                // "point of sale" for manual POS orders
//         store_id, dining_option,
//         line_items: [ { item_name, quantity, sku, line_note, ... } ],
//         ...
//       }
//     ]
//   }
//
// IMPORTANT: Andrea (the voice agent) also creates Loyverse receipts via
// the API for every phone order, and those already get printed directly
// through create_order -> printQueue.js. If we didn't filter by `source`
// here, this webhook would print Andrea's orders a SECOND time. So we
// only act on source === "point of sale" (i.e. orders entered manually
// in the Loyverse app) and ignore everything else.
//
// We also dedupe by receipt_number in memory, since "receipts.update"
// fires again when a receipt is finalized/edited, and we only want to
// print once per receipt.

const express = require('express');
const router = express.Router();

// printQueue.js exports `enqueue(order)`, not `pushToQueue` — using the
// wrong name here was the original bug: require() succeeded (no error
// thrown), but the property was undefined, so orders were silently
// dropped instead of reaching the queue.
let enqueue;
try {
  enqueue = require('./printQueue').enqueue;
  if (typeof enqueue !== 'function') {
    console.warn('[loyverseWebhook] printQueue.enqueue is not a function — ' +
      'orders will only be logged, not printed, until this is fixed.');
    enqueue = null;
  }
} catch (e) {
  console.warn('[loyverseWebhook] Could not load printQueue.enqueue — ' +
    'orders will only be logged, not printed, until this is wired up.');
}

const OUR_STORE_ID = '2ab89827-201c-4f7e-a869-5cf4f4baf7e9';

// Simple in-memory dedupe (resets on server restart — fine for a pilot).
// Swap for your existing dedupe.js if you'd rather share that logic.
const processedReceipts = new Set();

function mapDiningOptionToServiceType(diningOption) {
  if (!diningOption) return 'pickup';
  const normalized = diningOption.toLowerCase();
  // termux-print-agent.js only checks for the exact string 'delivery' —
  // anything else prints as "RECOGIDA" (pickup).
  if (normalized.includes('domicilio')) return 'delivery';
  return 'pickup';
}

function mapPaymentMethod(payments) {
  if (!payments || payments.length === 0) return 'cash';
  const type = (payments[0].type || '').toUpperCase();
  // Loyverse payment types seen so far: NONINTEGRATEDCARD (card), CASH.
  // Treat anything that isn't clearly cash as card, since that's the
  // termux agent's only other option.
  if (type.includes('CASH')) return 'cash';
  return 'card';
}

router.post('/webhooks/loyverse-receipt', express.json(), (req, res) => {
  const token = req.query.token;
  if (!token || token !== process.env.LOYVERSE_WEBHOOK_TOKEN) {
    console.warn('[loyverseWebhook] Rejected request with invalid/missing token');
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Ack immediately — Loyverse doesn't need to wait for kitchen printing.
  res.status(200).json({ received: true });

  const receipts = req.body.receipts || [];

  for (const receipt of receipts) {
    try {
      // Only handle this store.
      if (receipt.store_id !== OUR_STORE_ID) continue;

      // Only handle manual POS-app orders — Andrea's API-created orders
      // are already printed via create_order -> printQueue directly.
      if (receipt.source !== 'point of sale') {
        console.log(`[loyverseWebhook] Skipping receipt ${receipt.receipt_number} ` +
          `(source="${receipt.source}", not a manual POS order)`);
        continue;
      }

      // Skip cancelled/voided receipts.
      if (receipt.cancelled_at) {
        console.log(`[loyverseWebhook] Skipping cancelled receipt ${receipt.receipt_number}`);
        continue;
      }

      // Dedupe — "receipts.update" can fire more than once per receipt.
      if (processedReceipts.has(receipt.receipt_number)) {
        console.log(`[loyverseWebhook] Already processed ${receipt.receipt_number}, skipping`);
        continue;
      }
      processedReceipts.add(receipt.receipt_number);

      // IMPORTANT: field names here must match exactly what
      // termux-print-agent.js's buildTicket(order) reads — it does not
      // know anything about Loyverse's own field names.
      const order = {
        source: 'loyverse_manual',
        receiptNumber: receipt.receipt_number,
        service_type: mapDiningOptionToServiceType(receipt.dining_option),
        payment_method: mapPaymentMethod(receipt.payments),
        total: receipt.total_money,
        // Loyverse's manual POS checkout has no dedicated fields for
        // customer name/phone/delivery address — until we find a better
        // source (e.g. looking up receipt.customer_id via the Customers
        // API), the practical workaround is: write "Nombre / Tel /
        // Dirección" into the receipt's Note field in the Loyverse app,
        // and it will show up here as delivery_notes.
        customer_name: null,
        customer_phone: null,
        delivery_address: null,
        delivery_notes: receipt.note || null,
        items: (receipt.line_items || []).map(li => ({
          name: li.item_name,
          quantity: li.quantity,
          // TODO: confirm the real shape of line_modifiers on a receipt
          // that actually has modifiers — Loyverse's field names for the
          // option text inside each modifier aren't confirmed yet.
          modifications: (li.line_modifiers || []).map(m => m.name || m.modifier_option_name || m.option_name || m),
        })),
      };

      console.log('[loyverseWebhook] Queuing order for printing:', JSON.stringify(order));

      if (enqueue) {
        enqueue(order);
      }
    } catch (err) {
      console.error('[loyverseWebhook] Failed to process a receipt:', err);
    }
  }
});

module.exports = router;

// ---------------------------------------------------------------------
// In index.js, near your other app.use(...) calls:
//
//   const loyverseWebhookRouter = require('./loyverseWebhook');
//   app.use(loyverseWebhookRouter);
// ---------------------------------------------------------------------
