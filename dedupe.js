// dedupe.js
// Retell (y potencialmente otras plataformas) puede disparar la misma llamada a una
// función varias veces mientras los argumentos todavía se están generando en streaming,
// enviando "fotos" incompletas de los mismos datos con solo milisegundos de diferencia.
// Esta protección descarta un pedido si otro muy similar (mismo teléfono + mismo total)
// ya se procesó hace menos de RECENT_WINDOW_MS.

const RECENT_WINDOW_MS = 20000; // 20 segundos
let recentOrders = [];

function cleanup() {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  recentOrders = recentOrders.filter((o) => o.timestamp >= cutoff);
}

function signatureFor(order) {
  const phone = String(order.customer_phone || '').replace(/\s+/g, '');
  const total = Number(order.total) || 0;
  const serviceType = order.service_type || '';
  return `${serviceType}|${phone}|${total.toFixed(2)}`;
}

/**
 * Devuelve true si este pedido parece un duplicado de uno ya procesado hace poco.
 * Si no lo es, lo registra como "visto" para futuras comprobaciones.
 */
function isDuplicate(order) {
  cleanup();
  const sig = signatureFor(order);
  const found = recentOrders.some((o) => o.signature === sig);
  if (!found) {
    recentOrders.push({ signature: sig, timestamp: Date.now() });
  }
  return found;
}

module.exports = { isDuplicate };
