// loadState.js
// Estado compartido de carga de cocina. Lo usan: la voz (Andrea, /tools/check-load),
// las páginas web públicas (/public/status y /public-order) y los enlaces de
// administración (/admin/set-load, /admin/pause, /admin/resume).
// Solo en memoria: si el servidor reinicia, vuelve a "normal".

const AUTO_BUSY_THRESHOLD = 5;          // pedidos en 30 min para subir solo a level1
const LOAD_WINDOW_MS = 30 * 60 * 1000;

let recentOrderTimestamps = [];
let manualPauseUntil = 0;               // ms; 0 = sin pausa
let currentLoadLevel = 'normal';        // 'normal' | 'level1' | 'level2'
let levelExpiresAt = 0;                 // ms; el nivel manual vuelve a "normal" al cerrar la cocina

// --- Hora de cierre (Europe/Madrid): dom-jue 23:00, vie-sáb 23:30 ---
const TZ = 'Europe/Madrid';
function madridParts(ts) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23',
  });
  const o = {};
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second, wd: o.weekday };
}
// Instante (ms UTC) en que en Madrid son y-mo-d h:mi.
function madridLocalToMs(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = madridParts(guess);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  const offset = asUtc - guess; // desfase de Madrid respecto a UTC en ese momento
  return guess - offset;
}
// Próximo cierre de cocina estrictamente posterior a "from".
function nextClosingMs(from) {
  for (let add = 0; add <= 8; add++) {
    const t = from + add * 24 * 3600 * 1000;
    const p = madridParts(t);
    const closeMin = (p.wd === 'Fri' || p.wd === 'Sat') ? 23 * 60 + 30 : 23 * 60;
    const cand = madridLocalToMs(p.y, p.mo, p.d, Math.floor(closeMin / 60), closeMin % 60);
    if (cand > from) return cand;
  }
  return from + 12 * 3600 * 1000; // no debería ocurrir
}

// Mensajes largos (para la voz de Andrea)
const LOAD_LEVEL_MESSAGES = {
  normal: {
    delivery: 'Tiempo de entrega habitual: 40-50 minutos (hasta 1h15 en hora punta).',
    pickup: 'Tiempo de recogida habitual: 20-25 minutos.',
  },
  level1: {
    delivery: 'Ahora mismo tenemos más pedidos de lo habitual: el tiempo de entrega estimado es de 1 hora a 1 hora y cuarto, pero haremos todo lo posible por servirlo lo antes posible.',
    pickup: 'Ahora mismo tenemos más pedidos de lo habitual: el tiempo de recogida estimado es de 35 minutos, pero haremos todo lo posible por tenerlo listo antes.',
  },
  level2: {
    delivery: 'Ahora mismo tenemos mucha demanda: el tiempo de entrega estimado es de 1 hora y cuarto a 1 hora y media, pero haremos todo lo posible por servirlo lo antes posible.',
    pickup: 'Ahora mismo tenemos mucha demanda: el tiempo de recogida estimado es de 45 minutos, pero haremos todo lo posible por tenerlo listo antes.',
  },
};

// Tiempos cortos (para las páginas web)
const WEB_TIMES = {
  normal: { delivery: '40-50 min', pickup: '20-25 min', busy: false },
  level1: { delivery: '1 h - 1 h 15 min', pickup: '≈ 35 min', busy: true },
  level2: { delivery: '1 h 15 - 1 h 30 min', pickup: '≈ 45 min', busy: true },
};

function registerNewOrder() {
  recentOrderTimestamps.push(Date.now());
}

function getStatus() {
  const now = Date.now();
  // Al cerrar la cocina, el nivel puesto a mano se restablece solo a "normal".
  if (currentLoadLevel !== 'normal' && levelExpiresAt && now >= levelExpiresAt) {
    currentLoadLevel = 'normal';
    levelExpiresAt = 0;
  }
  recentOrderTimestamps = recentOrderTimestamps.filter((t) => now - t <= LOAD_WINDOW_MS);
  const orderCount = recentOrderTimestamps.length;
  const isPaused = now < manualPauseUntil;

  // Con mucha demanda automática y nivel manual "normal", subimos a level1;
  // nunca bajamos un nivel que el personal haya puesto más alto.
  let level = currentLoadLevel;
  if (orderCount >= AUTO_BUSY_THRESHOLD && level === 'normal') level = 'level1';

  return {
    is_paused: isPaused,
    paused_until: isPaused ? manualPauseUntil : null,
    load_level: level,
    orders_last_30min: orderCount,
    delivery_message: LOAD_LEVEL_MESSAGES[level].delivery,
    pickup_message: LOAD_LEVEL_MESSAGES[level].pickup,
    delivery_time: WEB_TIMES[level].delivery,
    pickup_time: WEB_TIMES[level].pickup,
    busy: WEB_TIMES[level].busy,
  };
}

function setLevel(level) {
  if (!LOAD_LEVEL_MESSAGES[level]) return false;
  currentLoadLevel = level;
  levelExpiresAt = level === 'normal' ? 0 : nextClosingMs(Date.now());
  return true;
}

function pause(minutes) {
  manualPauseUntil = Date.now() + minutes * 60000;
  return manualPauseUntil;
}

function resume() {
  manualPauseUntil = 0;
}

function levelExpiry() { return currentLoadLevel !== 'normal' ? levelExpiresAt : 0; }

module.exports = { registerNewOrder, getStatus, setLevel, pause, resume, levelExpiry, nextClosingMs, LOAD_LEVEL_MESSAGES };
