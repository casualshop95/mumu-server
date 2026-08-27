// calculateTotal.js
const { normalize, PRODUCTS, EXTRAS, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } = require('./catalog');

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
    const key = normalize(rawItem.name);
    const qty = Number(rawItem.quantity) > 0 ? Number(rawItem.quantity) : 1;
    const basePrice = PRODUCTS[key];

    if (basePrice === undefined) {
      unknownItems.push(rawItem.name);
      continue; // no lo sumamos: mejor que el agente lo derive a redirect() antes que inventar un precio
    }

    let lineExtrasTotal = 0;
    const appliedExtras = [];

    for (const extraRaw of rawItem.extras || []) {
      const extraKey = normalize(extraRaw);
      const extraPrice = EXTRAS[extraKey];
      if (extraPrice === undefined) {
        unknownExtras.push(extraRaw);
        continue;
      }
      lineExtrasTotal += extraPrice;
      appliedExtras.push({ name: extraRaw, price: extraPrice });
    }

    const lineTotal = (basePrice + lineExtrasTotal) * qty;
    subtotal += lineTotal;

    lines.push({
      name: rawItem.name,
      quantity: qty,
      base_price: basePrice,
      modifications: rawItem.modifications || [], // gratis, solo informativo
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
