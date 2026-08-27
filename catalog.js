// catalog.js
// Catálogo de precios de MU-MU GRILL, extraído de la Knowledge Base (02_MENU.md, 03_MODIFICACIONES_Y_EXTRAS.md).
// Si cambia el menú o los precios, actualiza SOLO este archivo — el resto del servidor no necesita tocarse.

function normalize(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// --- Productos (nombre normalizado -> precio base en EUR) ---
const PRODUCTS = {
  // Hamburguesas (todas incluyen patatas fritas bastón 200g)
  mr_classic: 12.00,
  cheddar_bacon: 12.50,
  crunchy_chicken: 11.50,
  smoked_bbq: 14.00,
  cosa_nostra: 14.00,
  el_pastor: 14.00,
  pantera_negra: 14.00,
  pulled_pork_burger: 14.00,
  bosque_azul: 14.00,

  // Complementos
  patatas_fritas: 3.50,
  patatas_fritas_de_gajo: 4.00,
  alitas_de_pollo_fritas: 8.00,
  alitas_de_pollo_en_salsa_bbq: 8.00,
  alitas_de_pollo_en_salsa_bbq_picante: 8.00,
  alitas_de_pollo_en_salsa_buffalo: 8.00,

  // Bebidas
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

  // Postres
  tartaleta_de_manzana: 4.90,
  brownie_con_nueces: 4.50,
};

// --- Extras con coste (nombre normalizado -> precio en EUR) ---
const EXTRAS = {
  extra_bacon: 1.00,
  extra_queso_cheddar: 1.00,
  extra_cheddar: 1.00,
  extra_queso_mozzarella: 1.00,
  extra_mozzarella: 1.00,
  extra_queso_rulo_de_cabra: 1.00,
  extra_rulo_de_cabra: 1.00,
  extra_cebolla_caramelizada: 1.00,
  extra_pulled_pork: 2.00,
  extra_salsa_para_las_patatas: 0.50,
  extra_salsa_patatas: 0.50,
  extra_salsa_de_cereza: 1.00,
  extra_salsa_cereza: 1.00,
  // Cambio de patatas bastón incluidas por gajo/rústicas/deluxe (no es ración extra, es sustitución con suplemento)
  cambio_patatas_gajo: 0.50,
  cambio_patatas_rusticas: 0.50,
  cambio_patatas_deluxe: 0.50,
};

// Modificaciones que SIEMPRE son gratuitas (quitar ingredientes de la receta original)
// No hace falta listarlas todas: cualquier modificación que empiece por "sin_" y no esté en EXTRAS se considera gratuita.

const DELIVERY_FEE = 3.00;
const FREE_DELIVERY_THRESHOLD = 18.00;

module.exports = { normalize, PRODUCTS, EXTRAS, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD };
