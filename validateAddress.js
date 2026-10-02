// validateAddress.js
// Valida una dirección de entrega con Google Geocoding API.
// Requiere la variable de entorno GOOGLE_MAPS_API_KEY (Railway -> Variables).
// Node 18+ (fetch global).

const ALLOWED_POSTAL_CODES = ['28041', '28021'];
const TIMEOUT_MS = 4000;

function getComponent(components, type) {
  const c = (components || []).find((x) => x.types.includes(type));
  return c ? c.long_name : null;
}

async function validateAddress(rawAddress) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const address = String(rawAddress || '').trim();

  if (!address) {
    return { status: 'not_found', message: 'No se ha recibido ninguna dirección.' };
  }
  if (!key) {
    console.error('[validateAddress] Falta GOOGLE_MAPS_API_KEY');
    return { status: 'error', message: 'Servicio de validación no disponible.' };
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('components', 'country:ES|locality:Madrid');
  url.searchParams.set('region', 'es');
  url.searchParams.set('language', 'es');
  url.searchParams.set('key', key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let data;
  try {
    const res = await fetch(url, { signal: controller.signal });
    data = await res.json();
  } catch (err) {
    console.error('[validateAddress] Error de red/timeout:', err.message);
    return { status: 'error', message: 'No se pudo validar la dirección.' };
  } finally {
    clearTimeout(timer);
  }

  if (data.status === 'ZERO_RESULTS') {
    return { status: 'not_found', message: 'No se ha encontrado esa dirección.' };
  }
  if (data.status !== 'OK' || !data.results || !data.results.length) {
    console.error('[validateAddress] Estado Google:', data.status, data.error_message || '');
    return { status: 'error', message: 'No se pudo validar la dirección.' };
  }

  const best = data.results[0];
  const comps = best.address_components;
  const postalCode = getComponent(comps, 'postal_code');
  const streetNumber = getComponent(comps, 'street_number');
  const route = getComponent(comps, 'route');
  const locationType = best.geometry && best.geometry.location_type;

  const result = {
    formatted_address: best.formatted_address,
    street: route,
    street_number: streetNumber,
    postal_code: postalCode,
    partial_match: !!best.partial_match,
    location_type: locationType,
    lat: best.geometry && best.geometry.location.lat,
    lng: best.geometry && best.geometry.location.lng,
  };

  // Sin calle reconocida: la dirección es demasiado vaga
  if (!route) {
    return { ...result, status: 'not_found', message: 'No se ha encontrado esa calle.' };
  }

  // Sin código postal: no podemos comprobar la zona, pedimos más detalle
  if (!postalCode) {
    return { ...result, status: 'needs_detail', message: 'Falta el número o más detalle de la dirección.' };
  }

  // Fuera de la zona de reparto
  if (!ALLOWED_POSTAL_CODES.includes(postalCode)) {
    return { ...result, status: 'out_of_zone', message: 'La dirección está fuera de la zona de reparto.' };
  }

  // En zona, pero sin número de portal
  if (!streetNumber) {
    return { ...result, status: 'needs_detail', message: 'Falta el número del portal.' };
  }

  return { ...result, status: 'ok', message: 'Dirección válida y dentro de la zona de reparto.' };
}

module.exports = { validateAddress, ALLOWED_POSTAL_CODES };
