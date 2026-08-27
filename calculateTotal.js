const { normalize, PRODUCTS, EXTRAS, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } = require('./catalog');

/**
 * calculateTotal підтримує два формати items:
 * 1) ["Cheddar Bacon", "Pantera Negra"]
 * 2) [{ name: "Cheddar Bacon", quantity: 1, extras: [] }]
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
    // Якщо Happ надсилає рядок "Cheddar Bacon" замість об'єкта
    const itemName = typeof rawItem === 'string' ? rawItem : rawItem.name;
    const qty = (typeof rawItem === 'object' && Number(rawItem.quantity) > 0) ? Number(rawItem.quantity) : 1;
    const itemExtras = (typeof rawItem === 'object' && Array.isArray(rawItem.extras)) ? rawItem.extras : [];
    const itemModifications = (typeof rawItem === 'object' && Array.isArray(rawItem.modifications)) ? rawItem.modifications : [];

    if (!itemName) {
      continue;
    }

    const key = normalize(itemName);
    const basePrice = PRODUCTS[key];

    if (basePrice === undefined) {
      unknownItems.push(itemName);
      continue;
    }

    let lineExtrasTotal = 0;
    const appliedExtras = [];

    for (const extraRaw of itemExtras) {
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
      name: itemName,
      quantity: qty,
      base_price: basePrice,
      modifications: itemModifications,
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
  const st = String(service_type || 'pickup').toLowerCase();
  if (st === 'delivery') {
    deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  }

  const total = round2(subtotal + deliveryFee);

  return {
    service_type: st,
    lines,
    subtotal,
    delivery_fee: deliveryFee,
    free_delivery_threshold: FREE_DELIVERY_THRESHOLD,
    total,
    unknown_items: unknownItems,
    unknown_extras: unknownExtras,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateTotal };
