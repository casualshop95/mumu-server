// orderCache.js
// Retell (u otras plataformas) a veces reconstruye los artículos de forma distinta
// entre la llamada a calculate_total y la llamada posterior a create_order —
// duplicando líneas, cambiando modificaciones, etc. — aunque el cliente solo
// confirmó UN pedido. Para evitarlo, guardamos aquí el último resultado válido
// de calculate_total por número de teléfono, y create_order lo usa como fuente
// de verdad en vez de los artículos que el agente vuelva a enviar.

const TTL_MS = 15 * 60 * 1000; // 15 minutos — más que suficiente para una llamada
const cache = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '');
}

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, entry] of cache.entries()) {
    if (entry.timestamp < cutoff) cache.delete(key);
  }
}

/**
 * Guarda el resultado de un calculate_total exitoso (sin unknown_items) para
 * este número de teléfono. Sobrescribe cualquier cálculo anterior — si el
 * cliente cambia el pedido, el cálculo más reciente es el que cuenta.
 */
function cacheCalculation(phone, result) {
  cleanup();
  const key = normalizePhone(phone);
  if (!key) return;
  cache.set(key, { result, timestamp: Date.now() });
}

/**
 * Devuelve el último resultado cacheado para este teléfono, o null si no hay
 * ninguno (o ha caducado).
 */
function getCachedCalculation(phone) {
  cleanup();
  const key = normalizePhone(phone);
  if (!key) return null;
  const entry = cache.get(key);
  return entry ? entry.result : null;
}

module.exports = { cacheCalculation, getCachedCalculation };
