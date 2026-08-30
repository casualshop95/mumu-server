// loyverseClient.js
const { resolveProductKey, resolveExtraKey, resolveCompoundName, fuzzyResolveProductKey, fuzzyResolveExtraKey, toArray } = require('./catalog');
const {
  STORE_ID,
  POS_DEVICE_ID,
  VARIANT_IDS,
  DELIVERY_FEE_VARIANT_ID,
  MODIFIER_OPTION_IDS,
  FREE_MODIFIER_OPTION_IDS,
  PUNTO_CARNE_OPTION_IDS,
  PAYMENT_TYPE_IDS,
} = require('./loyverseCatalog');

const LOYVERSE_API_URL = 'https://api.loyverse.com/v1.0/receipts';

/**
 * Construye el cuerpo del recibo a partir del pedido confirmado por el agente de voz.
 *
 * order = {
 *   service_type: "delivery" | "pickup",
 *   items: [{ name, quantity, modifications: [], extras: [] }],
 *   total: 15.50,               // el total ya calculado por calculate_total()
 *   payment_method: "cash" | "card",
 *   customer_name: "...",
 *   customer_phone: "...",
 *   delivery_address: "...",    // solo si delivery
 * }
 */
function buildReceiptPayload(order) {
  const lineItems = [];
  const notFound = [];

  for (const item of order.items || []) {
    let productKey = resolveProductKey(item.name);
    let extraKeysFromName = [];

    // Misma red de seguridad que calculateTotal.js: si el nombre viene con un extra pegado
    if (!productKey) {
      const compound = resolveCompoundName(item.name);
      if (compound) {
        productKey = compound.productKey;
        extraKeysFromName = compound.extraKeys;
      }
    }

    if (!productKey) {
      productKey = fuzzyResolveProductKey(item.name);
    }

    const variantId = productKey ? VARIANT_IDS[productKey] : undefined;

    if (!variantId) {
      notFound.push(item.name);
      continue;
    }

    const lineModifiers = [];
    const modificationsArr = toArray(item.modifications);
    const extrasArr = toArray(item.extras);

    // Aplica un extra de pago ya resuelto como modificador en la línea del producto.
    const applyPaidExtra = (extraKey) => {
      const optionId = MODIFIER_OPTION_IDS[extraKey];
      if (optionId) {
        lineModifiers.push({ modifier_option_id: optionId });
      }
    };

    // Extras con coste (ya venían separados en item.extras)
    for (const extraRaw of extrasArr) {
      let extraKey = resolveExtraKey(extraRaw);
      if (!extraKey) extraKey = fuzzyResolveExtraKey(extraRaw);
      if (extraKey) applyPaidExtra(extraKey);
    }

    // Modificaciones: primero comprobamos si en realidad es un extra de pago que
    // Retell colocó en el campo equivocado (misma defensa que en calculateTotal.js);
    // si no, se trata como modificación gratuita normal.
    for (const mod of modificationsArr) {
      let extraKey = resolveExtraKey(mod);
      if (!extraKey) extraKey = fuzzyResolveExtraKey(mod);
      if (extraKey) {
        applyPaidExtra(extraKey);
        continue;
      }
      const optionId = FREE_MODIFIER_OPTION_IDS[normalizeForLoyverse(mod)] || PUNTO_CARNE_OPTION_IDS[normalizeForLoyverse(mod)];
      if (optionId) {
        lineModifiers.push({ modifier_option_id: optionId, price: 0 });
      }
    }

    // Extras detectados dentro del propio nombre (red de seguridad)
    for (const extraKey of extraKeysFromName) {
      applyPaidExtra(extraKey);
    }

    lineItems.push({
      variant_id: variantId,
      quantity: item.quantity || 1,
      line_modifiers: lineModifiers.length > 0 ? lineModifiers : undefined,
      line_note: modificationsArr.length > 0 ? modificationsArr.join(', ') : undefined,
    });
  }

  // Coste de envío como línea aparte (ya viene decidido por calculate_total(): 0 si es gratis)
  if (order.service_type === 'delivery' && order.delivery_fee && order.delivery_fee > 0) {
    lineItems.push({ variant_id: DELIVERY_FEE_VARIANT_ID, quantity: 1 });
  }

  const paymentTypeId = PAYMENT_TYPE_IDS[order.payment_method] || PAYMENT_TYPE_IDS.cash;

  const payload = {
    store_id: STORE_ID,
    pos_device_id: POS_DEVICE_ID,
    source: 'Happ Voice Agent',
    note: buildNote(order),
    line_items: lineItems,
    payments: [
      {
        payment_type_id: paymentTypeId,
        money_amount: order.total,
      },
    ],
  };

  return { payload, notFound };
}

// Normalización simple solo para nombres de modificaciones sin coste (no pasan por catalog.js
// porque no tienen precio propio, pero necesitan el mismo formato de clave).
function normalizeForLoyverse(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildNote(order) {
  const parts = [];
  if (order.customer_name) parts.push(`Cliente: ${order.customer_name}`);
  if (order.service_type === 'delivery' && order.delivery_address) {
    parts.push(`Dirección: ${order.delivery_address}`);
  } else {
    parts.push('Recogida en local');
  }
  if (order.customer_phone) parts.push(`Tel: ${order.customer_phone}`);
  if (order.requested_time) parts.push(`Hora solicitada: ${order.requested_time}`);
  return parts.join(' | ');
}

async function createLoyverseReceipt(order, accessToken) {
  const { payload, notFound } = buildReceiptPayload(order);

  if (payload.line_items.length === 0) {
    return { success: false, error: 'NO_VALID_ITEMS', notFound };
  }

  const response = await fetch(LOYVERSE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return { success: false, error: 'LOYVERSE_API_ERROR', status: response.status, details: data };
  }

  return { success: true, receipt: data, notFound };
}

module.exports = { buildReceiptPayload, createLoyverseReceipt };
