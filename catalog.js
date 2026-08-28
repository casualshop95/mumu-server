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
  extra_queso_cheddar: 'extra_cheddar',
  extra_queso_mozzarella: 'extra_mozzarella',
  extra_queso_rulo_de_cabra: 'extra_rulo_de_cabra',
  extra_salsa_para_las_patatas: 'extra_salsa_patatas',
  extra_salsa_de_cereza: 'extra_salsa_cereza',
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
  toArray,
};
