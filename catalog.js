// catalog.js
// Catálogo de precios de MU-MU GRILL.
//
// IMPORTANTE: las claves canónicas de PRODUCTS y EXTRAS deben coincidir exactamente
// con las claves usadas en loyverseCatalog.js (VARIANT_IDS / MODIFIER_OPTION_IDS).
// Los sinónimos (PRODUCT_SYNONYMS / EXTRA_SYNONYMS) solo redirigen a esa clave canónica —
// así el precio y el ID de Loyverse nunca pueden desincronizarse entre sí.

function normalize(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// --- Productos: SOLO claves canónicas (mismas que loyverseCatalog.js) -> precio base en EUR ---
const PRODUCTS = {
  mr_classic: 12.00,
  cheddar_bacon: 12.50,
  crunchy_chicken: 11.50,
  smoked_bbq: 14.00,
  cosa_nostra: 14.00,
  el_pastor: 14.00,
  pantera_negra: 14.00,
  pulled_pork_burger: 14.00,
  bosque_azul: 14.00,

  patatas_fritas: 3.50,
  patatas_fritas_de_gajo: 4.00,
  alitas_de_pollo_fritas: 8.00,
  alitas_de_pollo_en_salsa_bbq: 8.00,
  alitas_de_pollo_en_salsa_bbq_picante: 8.00,
  alitas_de_pollo_en_salsa_buffalo: 8.00,

  coca_cola_classic: 2.50,
  coca_cola_zero: 2.50,
  fanta_naranja: 2.50,
  fanta_limon: 2.50,
  aquarius_limon: 2.50,
  aquarius_naranja: 2.50,
  nestea: 2.50,
  agua_sin_gas: 1.00,
  mahou_5_estrellas: 2.50,
  mahou_sin_alcohol: 2.50,

  tartaleta_de_manzana: 4.90,
  brownie_con_nueces: 4.50,

  // Pizzas
  margherita: 9.00,
  prosciutto_funghi: 10.50,
  di_parma: 10.50,
  tonno_e_cipolla: 10.50,
  pepperoni: 10.50,
  pizza_bbq: 10.50,
  quattro_formaggi: 10.50,
  chicken_pesto: 10.50,
  huerta_de_la_nonna: 10.50,

  // Otros complementos
  nuggets_de_pollo: 6.00,
  croquetas_de_jamon: 7.00,
};

// --- Sinónimos de productos: alias normalizado -> clave canónica de PRODUCTS ---
// Añade aquí cualquier forma en que el agente pueda nombrar un plato — NUNCA un precio nuevo.
const PRODUCT_SYNONYMS = {
  mr_classic_burger: 'mr_classic',
  classic: 'mr_classic',
  hamburguesa_classic: 'mr_classic',

  cheddar_bacon_burger: 'cheddar_bacon',
  cheddar: 'cheddar_bacon',
  hamburguesa_cheddar: 'cheddar_bacon',

  crunchy_chicken_burger: 'crunchy_chicken',
  crunchy: 'crunchy_chicken',
  hamburguesa_de_pollo: 'crunchy_chicken',

  smoked_bbq_burger: 'smoked_bbq',
  bbq_burger: 'smoked_bbq',

  bbq_pizza: 'pizza_bbq',
  pizza_de_bbq: 'pizza_bbq',
  pizza_barbacoa: 'pizza_bbq',
  barbacoa: 'pizza_bbq', // sin ambigüedad: la hamburguesa se llama "Smoked BBQ", nunca "Barbacoa"

  cosa_nostra_burger: 'cosa_nostra',

  el_pastor_burger: 'el_pastor',
  hamburguesa_el_pastor: 'el_pastor',

  pantera_negra_burger: 'pantera_negra',
  pantera: 'pantera_negra',

  pulled_pork: 'pulled_pork_burger',

  bosque_azul_burger: 'bosque_azul',

  patatas: 'patatas_fritas',
  patatas_normales: 'patatas_fritas',

  patatas_gajo: 'patatas_fritas_de_gajo',
  gajo: 'patatas_fritas_de_gajo',

  alitas_de_pollo: 'alitas_de_pollo_fritas',
  alitas: 'alitas_de_pollo_fritas',

  coca_cola: 'coca_cola_classic',
  cocacola: 'coca_cola_classic',
  coca_zero: 'coca_cola_zero',
  fanta: 'fanta_naranja',
  agua: 'agua_sin_gas',
  mahou: 'mahou_5_estrellas',
  cerveza: 'mahou_5_estrellas',

  tartaleta: 'tartaleta_de_manzana',
  postre_de_manzana: 'tartaleta_de_manzana',
  brownie: 'brownie_con_nueces',

  // Pizzas — OJO: "bbq" a secas NO se mapea a ninguna, porque existe tanto
  // la hamburguesa "Smoked BBQ" como la pizza "BBQ" — el agente debe preguntar
  // cuál de las dos si el cliente solo dice "BBQ".
  pizza_margherita: 'margherita',
  margarita: 'margherita',
  pizza_prosciutto_funghi: 'prosciutto_funghi',
  pizza_di_parma: 'di_parma',
  pizza_tonno_e_cipolla: 'tonno_e_cipolla',
  pizza_pepperoni: 'pepperoni',
  pizza_quattro_formaggi: 'quattro_formaggi',
  cuatro_quesos: 'quattro_formaggi',
  pizza_chicken_pesto: 'chicken_pesto',
  pizza_huerta_de_la_nonna: 'huerta_de_la_nonna',

  nuggets: 'nuggets_de_pollo',
  croquetas: 'croquetas_de_jamon',
  croquetas_de_jamon_6ud: 'croquetas_de_jamon',
};

// --- Extras con coste: SOLO claves canónicas (mismas que loyverseCatalog.js) -> precio en EUR ---
const EXTRAS = {
  extra_bacon: 1.00,
  extra_cheddar: 1.00,
  extra_mozzarella: 1.00,
  extra_cebolla_caramelizada: 1.00,
  extra_rulo_de_cabra: 1.00,
  extra_pulled_pork: 2.00,
  extra_salsa_patatas: 0.50,
  extra_salsa_cereza: 1.00,
  // Cambio de patatas bastón incluidas por gajo/rústicas/deluxe (sustitución con suplemento)
  cambio_patatas_gajo: 0.50,
  cambio_patatas_rusticas: 0.50,
  cambio_patatas_deluxe: 0.50,
};

// --- Sinónimos de extras: alias normalizado -> clave canónica de EXTRAS ---
const EXTRA_SYNONYMS = {
  bacon: 'extra_bacon',
  cheddar: 'extra_cheddar',
  mozzarella: 'extra_mozzarella',
  rulo_de_cabra: 'extra_rulo_de_cabra',
  cebolla_caramelizada: 'extra_cebolla_caramelizada',
  pulled_pork: 'extra_pulled_pork',
  salsa_cereza: 'extra_salsa_cereza',
  salsa_patatas: 'extra_salsa_patatas',
  extra_queso_cheddar: 'extra_cheddar',
  extra_queso_mozzarella: 'extra_mozzarella',
  extra_queso_rulo_de_cabra: 'extra_rulo_de_cabra',
  extra_salsa_para_las_patatas: 'extra_salsa_patatas',
  extra_salsa_de_cereza: 'extra_salsa_cereza',
  patatas_de_gajo: 'cambio_patatas_gajo',
  patatas_gajo: 'cambio_patatas_gajo',
  cambio_patatas: 'cambio_patatas_gajo',
  patatas_rusticas: 'cambio_patatas_rusticas',
  patatas_de_deluxe: 'cambio_patatas_deluxe',
};

const DELIVERY_FEE = 3.00;
const FREE_DELIVERY_THRESHOLD = 18.00;

/**
 * Resuelve el nombre de un producto (ya escrito por el cliente/agente) a su clave canónica.
 * Devuelve null si no coincide con nada del catálogo.
 */
function resolveProductKey(rawName) {
  const key = normalize(rawName);
  if (PRODUCTS[key] !== undefined) return key;
  if (PRODUCT_SYNONYMS[key]) return PRODUCT_SYNONYMS[key];
  return null;
}

/**
 * Resuelve el nombre de un extra a su clave canónica. Devuelve null si no coincide.
 */
function resolveExtraKey(rawName) {
  const key = normalize(rawName);
  if (EXTRAS[key] !== undefined) return key;
  if (EXTRA_SYNONYMS[key]) return EXTRA_SYNONYMS[key];
  return null;
}

// --- Búsqueda difusa (fuzzy matching) ---
// Último recurso cuando el nombre no coincide exactamente ni con ningún sinónimo
// registrado — por ejemplo, si el cliente lo pronuncia de forma ligeramente distinta,
// con una palabra de más/menos, o el agente comete un pequeño error de transcripción.
// Se basa en la distancia de Levenshtein (número mínimo de ediciones de un carácter
// para pasar de una palabra a otra) sobre las palabras clave del nombre.

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Distancia máxima tolerada, en función de la longitud de la palabra más larga.
function maxAllowedDistance(len) {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

/**
 * Intenta encontrar el producto más parecido al nombre dado, usando distancia de edición
 * sobre la clave completa normalizada. Solo devuelve un resultado si la coincidencia es
 * lo bastante buena — si no, devuelve null en vez de arriesgarse a adivinar mal.
 */
function fuzzyResolveProductKey(rawName) {
  const key = normalize(rawName);
  if (!key) return null;

  const candidates = Object.keys(PRODUCTS).concat(Object.keys(PRODUCT_SYNONYMS));
  let best = null;
  let bestDistance = Infinity;

  for (const candidateKey of candidates) {
    const distance = levenshtein(key, candidateKey);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidateKey;
    }
  }

  if (best && bestDistance <= maxAllowedDistance(Math.max(key.length, best.length))) {
    return PRODUCTS[best] !== undefined ? best : PRODUCT_SYNONYMS[best];
  }
  return null;
}

/**
 * Igual que fuzzyResolveProductKey pero para extras.
 */
function fuzzyResolveExtraKey(rawName) {
  const key = normalize(rawName);
  if (!key) return null;

  const candidates = Object.keys(EXTRAS).concat(Object.keys(EXTRA_SYNONYMS));
  let best = null;
  let bestDistance = Infinity;

  for (const candidateKey of candidates) {
    const distance = levenshtein(key, candidateKey);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidateKey;
    }
  }

  if (best && bestDistance <= maxAllowedDistance(Math.max(key.length, best.length))) {
    return EXTRAS[best] !== undefined ? best : EXTRA_SYNONYMS[best];
  }
  return null;
}

// Palabras de conexión que se ignoran al intentar separar un nombre "pegado"
// como "El Pastor con extra de bacon" en producto + extra.
const CONNECTOR_WORDS = new Set(['con', 'extra', 'extras', 'de', 'del', 'la', 'el', 'y', 'sin']);

/**
 * Red de seguridad: si el agente envía el nombre del producto y un extra pegados
 * en un solo texto (en vez de usar el campo "extras" por separado), esta función
 * intenta separarlos automáticamente en vez de fallar o necesitar una entrada
 * manual por cada combinación posible.
 *
 * Devuelve { productKey, extraKeys: [] } o null si no se puede resolver.
 */
function resolveCompoundName(rawName) {
  const fullKey = normalize(rawName);
  const allProductKeys = Object.keys(PRODUCTS).concat(Object.keys(PRODUCT_SYNONYMS));

  // Probamos las claves de producto más largas primero (para no confundir "el_pastor" con un prefijo corto)
  const candidates = allProductKeys
    .filter((k) => fullKey.startsWith(k + '_'))
    .sort((a, b) => b.length - a.length);

  for (const candidateKey of candidates) {
    const productKey = PRODUCTS[candidateKey] !== undefined ? candidateKey : PRODUCT_SYNONYMS[candidateKey];
    const remainderRaw = fullKey.slice(candidateKey.length + 1);
    const remainderTokens = remainderRaw.split('_').filter((t) => t && !CONNECTOR_WORDS.has(t));
    if (remainderTokens.length === 0) continue;

    const remainderKey = remainderTokens.join('_');
    const extraKey = resolveExtraKey(remainderKey) || resolveExtraKey(remainderTokens[remainderTokens.length - 1]);

    if (extraKey) {
      return { productKey, extraKeys: [extraKey] };
    }
  }

  return null;
}

/**
 * Happ puede enviar modifications/extras como array o como un solo string
 * separado por comas (según el tipo de parámetro configurado en la herramienta).
 * Esta función normaliza ambos casos a un array de strings.
 */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Happ AI, en la práctica, no envía cada item de "items" de forma consistente
 * a pesar de que el esquema del tool está definido como Object con propiedades
 * (name, quantity, modifications, extras) en su panel. Se han observado AL MENOS
 * dos formatos distintos para el mismo tool, en llamadas distintas:
 *
 *   Formato "CSV plano":     "Mr Classic,1,,extra bacon"
 *   Formato "con etiquetas": "Mr Classic, quantity: 1, modifications: , extras: extra bacon"
 *
 * Esta función soporta AMBOS formatos (y objetos ya estructurados), detectando
 * etiquetas reconocidas ("quantity:", "modifications:", "extras:", "name:") en
 * cualquier posición y usando reglas posicionales solo como respaldo cuando
 * una parte no lleva etiqueta.
 */
const ITEM_FIELD_LABELS = {
  name: 'name',
  quantity: 'quantity',
  qty: 'quantity',
  cantidad: 'quantity',
  modifications: 'modifications',
  modification: 'modifications',
  modificaciones: 'modifications',
  extras: 'extras',
  extra: 'extras',
};

function parseItemEntry(raw) {
  if (raw && typeof raw === 'object') {
    // Ya viene como objeto — se usa tal cual.
    return {
      name: raw.name,
      quantity: raw.quantity,
      modifications: raw.modifications,
      extras: raw.extras,
    };
  }

  if (typeof raw !== 'string') {
    return { name: undefined, quantity: 1, modifications: '', extras: '' };
  }

  const rawParts = raw.split(',').map((p) => p.trim());
  const fields = {};
  const unlabeled = [];
  let lastLabel = null;

  for (const part of rawParts) {
    const colonIdx = part.indexOf(':');
    const rawLabel = colonIdx > -1 ? part.slice(0, colonIdx).trim().toLowerCase() : null;
    const mappedLabel = rawLabel ? ITEM_FIELD_LABELS[rawLabel] : undefined;

    if (mappedLabel) {
      fields[mappedLabel] = part.slice(colonIdx + 1).trim();
      lastLabel = mappedLabel;
      continue;
    }

    // Sin etiqueta reconocida: si la parte anterior era "modifications" o "extras"
    // (que pueden tener varios valores separados por coma), se trata como
    // continuación de esa misma lista en vez de un campo nuevo.
    if (lastLabel === 'modifications' || lastLabel === 'extras') {
      fields[lastLabel] = fields[lastLabel] ? `${fields[lastLabel]},${part}` : part;
    } else {
      unlabeled.push(part);
      lastLabel = null;
    }
  }

  // Rellena con reglas posicionales cualquier campo que no vino etiquetado.
  if (fields.name === undefined) {
    fields.name = unlabeled.length > 0 ? unlabeled.shift() : undefined;
  }
  if (fields.quantity === undefined) {
    const numIdx = unlabeled.findIndex((p) => /^\d+$/.test(p));
    if (numIdx > -1) fields.quantity = unlabeled.splice(numIdx, 1)[0];
  }
  if (fields.modifications === undefined && unlabeled.length > 0) {
    fields.modifications = unlabeled.shift();
  }
  if (fields.extras === undefined && unlabeled.length > 0) {
    fields.extras = unlabeled.join(',');
  }

  return {
    name: (fields.name || '').trim(),
    quantity: parseInt(fields.quantity, 10) || 1,
    modifications: (fields.modifications || '').trim(),
    extras: (fields.extras || '').trim(),
  };
}

function parseItemsList(rawItems) {
  // Caso más fiable: Happ envía TODO el array como un único string JSON
  // (parámetro configurado como String, no Array/Object). El agente debe
  // generar algo como: [{"name":"Mr Classic","quantity":1,"modifications":["sin cebolla"],"extras":["extra bacon"]}]
  if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => parseItemEntry(entry));
      }
    } catch (err) {
      // No era JSON válido — seguimos con el resto de la lógica por si acaso.
    }
  }

  if (!Array.isArray(rawItems)) return [];
  return rawItems.map(parseItemEntry);
}

module.exports = {
  normalize,
  PRODUCTS,
  PRODUCT_SYNONYMS,
  EXTRAS,
  EXTRA_SYNONYMS,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  resolveProductKey,
  resolveExtraKey,
  resolveCompoundName,
  fuzzyResolveProductKey,
  fuzzyResolveExtraKey,
  toArray,
  parseItemEntry,
  parseItemsList,
};
