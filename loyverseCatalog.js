// loyverseCatalog.js
// Mapea las claves normalizadas de catalog.js a los IDs reales de la cuenta de Loyverse de MU-MU GRILL.
// Si Loyverse cambia un ID (se borra y recrea un producto, por ejemplo), solo hay que actualizar este archivo.

const STORE_ID = '2ab89827-201c-4f7e-a869-5cf4f4baf7e9';
// Dispositivo POS "1", conectado físicamente a la impresora de cocina.
// Se incluye en cada recibo creado por API con la esperanza de que dispare
// la impresión automática — Loyverse no garantiza esto oficialmente para
// recibos creados vía API (ver README.md).
const POS_DEVICE_ID = '3d06b0e9-5d84-4059-b223-b24edae16cc2';

// --- variant_id de cada producto (mismas claves que PRODUCTS en catalog.js) ---
const VARIANT_IDS = {
  mr_classic: 'c5ddd253-e947-4c83-8d85-a3baa42c74b1',
  cheddar_bacon: 'a2b8e0a3-082e-4242-82ff-1e032cc4b247',
  crunchy_chicken: '273f1657-4016-4c4b-b9f5-248a4219ecf5',
  smoked_bbq: '359aa650-4204-4b2d-8ece-331d4b3ad5bc',
  cosa_nostra: '8529c075-ce30-4aa4-a813-0cfe88d165d2',
  el_pastor: '325fbe4a-96f6-459f-907e-9d45376f693f',
  pantera_negra: '07d666f1-fa3c-4158-8038-77677c92440a',
  pulled_pork_burger: 'c4821345-0b4f-428b-b4c9-bdbec77c35c4',
  bosque_azul: '74c63b82-1ab7-4e5d-8e6c-3771b4d36f0c',

  patatas_fritas: '514d31fe-b6c8-4ee4-a613-6b10e0367677',
  patatas_fritas_de_gajo: '651192fc-4b7f-41aa-83e3-497d468a4d9d',
  alitas_de_pollo_fritas: 'ae2e508a-8133-4ab4-b299-098da7891866',
  alitas_de_pollo_en_salsa_bbq: 'ba508bf3-2bbb-4f74-900d-ebf096f048e6',
  alitas_de_pollo_en_salsa_bbq_picante: 'a5536519-dacb-41aa-a049-720f2ef5b3b3',
  alitas_de_pollo_en_salsa_buffalo: 'cff98509-d7f4-4956-96d1-36a54050e2f2',

  coca_cola_classic: '438cd614-0e31-4dd4-9172-4acbf9fabc57',
  coca_cola_zero: '74b9a7c4-7403-4630-b74c-10f4833a5afe',
  fanta_naranja: '50a11cce-c7d2-4e04-87b0-8e8c6c3825f6',
  fanta_limon: '2519be84-04d1-4e2b-b3be-d69c13c812ea',
  aquarius_limon: 'c146a0b6-ba06-4edf-b111-bb6602146719',
  aquarius_naranja: 'ef61809e-8727-48db-925b-bdf2060abd84',
  nestea: '595c1c8f-67aa-48aa-991f-566692144343',
  agua_sin_gas: 'e6942767-c5d6-408e-b911-7cc3ca94e625',
  mahou_5_estrellas: '159a79ae-4838-428e-89d5-352dce40052c',
  mahou_sin_alcohol: 'd27ee035-9052-4116-9a1a-0381a8e78879',

  tartaleta_de_manzana: 'd79e430f-acdb-4ce3-b0bb-650fbbd50eb6',
  brownie_con_nueces: '3797228d-9302-486a-b854-239824e33772',

  // Pizzas
  margherita: '7a8bd0dc-4728-4827-99cc-4a1485c1cc61',
  prosciutto_funghi: '76e0714d-bc4d-4a12-a3a8-7e4926df84c2',
  di_parma: '4117ec8a-a05d-4c1b-be54-544607fbf3fe',
  tonno_e_cipolla: '6ce5e893-ea05-4c6e-aa71-f09b03d3514e',
  pepperoni: '815eac1b-288b-42b7-86ca-78129710e073', // antes "Diavola", renombrado en Loyverse
  pizza_bbq: '159ef4da-e287-45c5-b693-861064f12d60',
  quattro_formaggi: '9f0fcbe4-a1a9-4a91-8c6c-b36c0c9a272a',
  chicken_pesto: '93f968ac-5bbd-4e7d-9729-4c6a46342d72',
  huerta_de_la_nonna: 'a484b51e-32de-4be4-ad2d-40d9373a79d3',

  // Otros
  nuggets_de_pollo: '3d51843f-940c-4d27-b9fc-3cc9b74f8d6d',
  croquetas_de_jamon: '8f17d632-61c6-4ab5-b062-a5f193fc84f8',
};

// Producto especial: coste de envío como línea propia del pedido
const DELIVERY_FEE_VARIANT_ID = 'b6e942ab-32ab-4278-9b17-03bc089dff8d'; // "Servicio de entrega"

// --- modifier_option_id de cada extra/modificación con coste (mismas claves que EXTRAS en catalog.js) ---
const MODIFIER_OPTION_IDS = {
  extra_bacon: 'dc6b0d59-001d-4d63-a466-a013148ee52a',
  extra_queso_cheddar: 'f8dbbcf4-a009-4787-827a-69ad71934d72',
  extra_cheddar: 'f8dbbcf4-a009-4787-827a-69ad71934d72',
  extra_queso_mozzarella: '5b75493d-f1c4-48bc-8f93-8ab5caca28c0',
  extra_mozzarella: '5b75493d-f1c4-48bc-8f93-8ab5caca28c0',
  extra_cebolla_caramelizada: '1805dfd8-f516-4c35-8346-6298b30d33c1',
  extra_queso_rulo_de_cabra: '2c5996dc-800b-4abb-b9c4-b1bb7c332aa6',
  extra_rulo_de_cabra: '2c5996dc-800b-4abb-b9c4-b1bb7c332aa6',
  extra_pulled_pork: 'f849026f-0712-4cd8-b078-ec526c719b45',
  extra_salsa_para_las_patatas: 'e77ab93f-9794-47ae-8171-f9a4ebde7865',
  extra_salsa_patatas: 'e77ab93f-9794-47ae-8171-f9a4ebde7865',
  extra_salsa_de_cereza: '71049b9f-7f98-470b-a006-a5c7580e52b9',
  extra_salsa_cereza: '71049b9f-7f98-470b-a006-a5c7580e52b9',
  // Cambio de patatas por gajo/rústicas/deluxe — ahora es un modificador de pago
  // (grupo "Extras" en Loyverse), no un producto aparte.
  cambio_patatas_gajo: '3db3d180-3873-41a9-89a7-7156717fe709',
  cambio_patatas_rusticas: '3db3d180-3873-41a9-89a7-7156717fe709',
  cambio_patatas_deluxe: '3db3d180-3873-41a9-89a7-7156717fe709',
};

// --- modifier_option_id de las modificaciones SIN coste (grupo "MODIFICACIONES") ---
// Estas no afectan al precio, pero se envían igual a Loyverse para que aparezcan en el ticket de cocina.
const FREE_MODIFIER_OPTION_IDS = {
  sin_cebolla: 'bd30deac-c22b-496c-aecb-c9f3869fb2a1',
  sin_cebolla_a_la_plancha: '82994976-174f-4808-afcc-7ce32bccce17',
  sin_cebolla_frita: '3b72e33f-f2d7-4629-ba36-64cc09144782',
  sin_queso: 'a257fc6c-6418-46e8-a595-a1610ecf6278',
  sin_salsa: '5211860c-3c85-497d-9c88-1a14563b06e4',
  sin_mostaza: '1bb45a38-8b9b-4b2d-b03e-ef4ed7640bf6',
  sin_salsa_de_cereza: '672a1f72-0365-46c0-9a72-0de94bc2634b',
  salsa_aparte: '2048b023-ed04-4a74-8f70-ea6a9cb95338',
  sin_pepinillos: '74c305f4-e2c5-4a36-90b2-47bd0a6d5ff8',
  sin_tomate: 'a308121c-df93-4651-ab72-34ba5ff97190',
  sin_lechuga: '65531cbd-7ede-454b-96c8-3b8752f606b0',
  sin_bacon: 'd76f40b0-d111-4991-8af1-d14f6735e952',
  sin_rucula: '22623664-f0de-4fc7-888a-c89e871aaeb3',
  sin_salsa_de_tomate: 'ed17d2d1-1134-422a-acbf-a05debba22a1',
  sin_champinones: 'dd457440-304c-4046-bb1a-9063757a8f72',
  sin_queso_azul: '7fa16cd2-adfa-4af3-a4c9-b6a10b6d8753',
  sin_berenjenas: '4145d597-8170-44a2-8f8d-68181b5ee757',
};

// --- Punto de la carne (sin coste) ---
const PUNTO_CARNE_OPTION_IDS = {
  bien_hecha: '5c1eaf6f-118a-4ad7-a4b1-6d8df78cd888',
  poco_hecha: 'e3e57404-1456-4b17-810e-5ec41b939d01',
  muy_hecha: '88d505a5-1e5d-4008-ac86-eccc6cb56783',
  al_punto: '3ee09875-2e39-4bc8-aa6e-8c6c1c3ddccd',
};

// --- payment_type_id ---
const PAYMENT_TYPE_IDS = {
  card: 'ee5125b2-ecdc-4c89-9f1d-7eedad687c25',   // Tarjeta
  cash: 'c9c886d5-319f-4c0f-a0da-72de7ddcc79d',   // Efectivo
};

module.exports = {
  STORE_ID,
  POS_DEVICE_ID,
  VARIANT_IDS,
  DELIVERY_FEE_VARIANT_ID,
  MODIFIER_OPTION_IDS,
  FREE_MODIFIER_OPTION_IDS,
  PUNTO_CARNE_OPTION_IDS,
  PAYMENT_TYPE_IDS,
};
