// calculateTotal.js
const {
  PRODUCTS,
  EXTRAS,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  resolveProductKey,
  resolveExtraKey,
  resolveCompoundName,
  fuzzyResolveProductKey,
  fuzzyResolveExtraKey,
  toArray,
} = require('./catalog');

/**
 * items: [
 *   {
 *     name: "Cheddar Bacon",
 *     quantity: 1,
 *     modifications: ["sin cebolla"],   // gratis, no afectan al precio
 *     extras: ["extra bacon", "cambio patatas gajo"]  // pueden tener coste
 *   },
 *   ...
 * ]
 * service_type: "delivery" | "pickup"
 */
function calculateTotal({ service_type, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'NO_ITEMS', message: 'El pedido no contiene artículos.' };
  }

  const lines = [];
  const unknownItems = [];
  const unknownExtras = [];
  let subtotal = 0;

  for (const rawItem of items) {
    const qty = Number(rawItem.quantity) > 0 ? Number(rawItem.quantity) : 1;
    let productKey = resolveProductKey(rawItem.name);
    let extraKeysFromName = [];
    let fuzzyMatched = false;

    // Red de seguridad: si el nombre no coincide con ningún producto tal cual,
    // puede que venga con un extra pegado (p. ej. "El Pastor con extra de bacon").
    // Intentamos separarlo automáticamente antes de darlo por desconocido.
    if (!productKey) {
      const compound = resolveCompoundName(rawItem.name);
      if (compound) {
        productKey = compound.productKey;
        extraKeysFromName = compound.extraKeys;
      }
    }

    // Último recurso: búsqueda difusa, por si el nombre está mal escrito, con
    // alguna palabra de más/menos, o ligeramente distinto al del menú oficial.
    if (!productKey) {
      const fuzzyKey = fuzzyResolveProductKey(rawItem.name);
      if (fuzzyKey) {
        productKey = fuzzyKey;
        fuzzyMatched = true;
      }
    }

    if (!productKey) {
      unknownItems.push(rawItem.name);
      continue; // no lo sumamos: mejor que el agente lo derive a redirect() antes que inventar un precio
    }

    const basePrice = PRODUCTS[productKey];
    let lineExtrasTotal = 0;
    const appliedExtras = [];

    // Extras que ya venían separados en rawItem.extras
    for (const extraRaw of toArray(rawItem.extras)) {
      let extraKey = resolveExtraKey(extraRaw);
      if (!extraKey) extraKey = fuzzyResolveExtraKey(extraRaw);
      if (!extraKey) {
        unknownExtras.push(extraRaw);
        continue;
      }
      lineExtrasTotal += EXTRAS[extraKey];
      appliedExtras.push({ name: extraRaw, key: extraKey, price: EXTRAS[extraKey] });
    }

    // Extras detectados dentro del propio nombre (ver red de seguridad arriba)
    for (const extraKey of extraKeysFromName) {
      lineExtrasTotal += EXTRAS[extraKey];
      appliedExtras.push({ name: extraKey, key: extraKey, price: EXTRAS[extraKey] });
    }

    const lineTotal = (basePrice + lineExtrasTotal) * qty;
    subtotal += lineTotal;

    lines.push({
      name: rawItem.name,
      product_key: productKey,
      fuzzy_matched: fuzzyMatched || undefined,
      quantity: qty,
      base_price: basePrice,
      modifications: toArray(rawItem.modifications), // gratis, solo informativo
      extras: appliedExtras,
      line_total: round2(lineTotal),
    });
  }

  if (lines.length === 0) {
    return {
      error: 'NO_VALID_ITEMS',
      message: 'Ningún artículo del pedido coincide con el catálogo.',
      unknown_items: unknownItems,
    };
  }

  subtotal = round2(subtotal);

  let deliveryFee = 0;
  if (service_type === 'delivery') {
    deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  }
  // pickup: sin coste de envío

  const total = round2(subtotal + deliveryFee);

  return {
    service_type: service_type || 'pickup',
    lines,
    subtotal,
    delivery_fee: deliveryFee,
    free_delivery_threshold: FREE_DELIVERY_THRESHOLD,
    total,
    unknown_items: unknownItems,   // si no está vacío, el agente debe usar redirect()
    unknown_extras: unknownExtras, // idem
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateTotal };
