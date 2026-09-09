// loyverseWebhook.js
//
// Handles incoming webhooks from Loyverse ("Recibo creado o actualizado").
// Lets Vitalii create an order remotely in the Loyverse POS app (from
// anywhere) and have it print automatically on the kitchen printer, the
// same way voice-agent orders already do via printQueue.js.
//
// SECURITY: Loyverse's Back Office UI for webhooks does not expose a
// signing secret, so instead of verifying X-Loyverse-Signature we protect
// this endpoint with a random token passed as a query parameter. Only
// requests with the correct token are accepted.
//
// Set up:
//   1. In Railway, add an env var:  LOYVERSE_WEBHOOK_TOKEN=<the random token>
//   2. In Loyverse, set the webhook URL to:
//        https://<your-railway-domain>/webhooks/loyverse-receipt?token=<the random token>
//   3. require and mount this router from index.js (see bottom of this file
//      for the one-line snippet to add there).

const express = require('express');
const router = express.Router();

// TODO: swap this in for the queue Andrea's create_order flow already
// writes to (e.g. `const { pushToQueue } = require('./printQueue');`)
// so both sources feed the same kitchen ticket pipeline.
let pushToQueue;
try {
  // Adjust the path/function name to match your actual printQueue.js export.
  pushToQueue = require('./printQueue').pushToQueue;
} catch (e) {
  console.warn('[loyverseWebhook] Could not load printQueue.pushToQueue — ' +
    'orders will only be logged, not printed, until this is wired up.');
}

router.post('/webhooks/loyverse-receipt', express.json(), (req, res) => {
  // --- 1. Token check ---
  const token = req.query.token;
  if (!token || token !== process.env.LOYVERSE_WEBHOOK_TOKEN) {
    console.warn('[loyverseWebhook] Rejected request with invalid/missing token');
    return res.status(403).json({ error: 'Forbidden' });
  }

  // --- 2. Log the raw payload ---
  // We haven't seen a real payload yet (the test notification failed while
  // the URL was still a placeholder). Until we've confirmed the actual
  // shape Loyverse sends, log everything so we can inspect it in Railway
  // logs on the first real test.
  console.log('[loyverseWebhook] Received payload:', JSON.stringify(req.body, null, 2));

  // Always ack quickly — Loyverse doesn't need to wait for kitchen printing.
  res.status(200).json({ received: true });

  // --- 3. Map to the print queue (PLACEHOLDER — adjust after step above) ---
  // Loyverse's receipt webhook payload commonly nests the receipt object;
  // exact field names will be confirmed from the logged payload. Sketch:
  try {
    const receipt = req.body.receipt || req.body; // adjust once confirmed

    // Skip receipts that aren't relevant (e.g. refunds, other stores).
    // if (receipt.store_id !== '2ab89827-201c-4f7e-a869-5cf4f4baf7e9') return;
    // if (receipt.receipt_type === 'REFUND') return;

    if (pushToQueue) {
      pushToQueue({
        source: 'loyverse_manual',
        receiptNumber: receipt.receipt_number,
        items: (receipt.line_items || []).map(li => ({
          name: li.item_name,
          quantity: li.quantity,
          notes: li.line_note || null,
        })),
        note: receipt.note || null,
        // orderType/address/payment fields to be added once we confirm
        // whether Loyverse includes them for POS-app-created receipts.
      });
    }
  } catch (err) {
    console.error('[loyverseWebhook] Failed to process payload:', err);
  }
});

module.exports = router;

// ---------------------------------------------------------------------
// Add this near your other app.use(...) calls in index.js:
//
//   const loyverseWebhookRouter = require('./loyverseWebhook');
//   app.use(loyverseWebhookRouter);
// ---------------------------------------------------------------------
