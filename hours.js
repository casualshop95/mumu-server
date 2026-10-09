// hours.js
//
// Shared opening-hours logic, extracted from index.js's /tools/check-hours
// route so it has a single source of truth — both that route (used by
// Andrea) and publicOrder.js (the public order form) call this same
// function, instead of keeping two separate copies that could drift apart
// if the hours ever change.

function checkHours() {
  // Testing switch: if FORCE_OPEN_FOR_TESTING=true is set in Railway, always
  // report open, without touching code. Remember to unset it before going
  // live for real.
  if (process.env.FORCE_OPEN_FOR_TESTING === 'true') {
    return {
      is_open: true,
      current_time: null,
      day_of_week: null,
      hours_today: null,
      note: 'FORCE_OPEN_FOR_TESTING activo',
    };
  }

  try {
    const now = new Date();
    const madridStr = now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
    const madridTime = new Date(madridStr);
    const day = madridTime.getDay(); // 0=domingo ... 6=sábado
    const totalMinutes = madridTime.getHours() * 60 + madridTime.getMinutes();

    const isFriSat = day === 5 || day === 6; // viernes o sábado
    const openMinutes = 19 * 60; // 19:00
    const lastOrderMinutes = isFriSat ? 23 * 60 + 15 : 22 * 60 + 45;

    const isOpen = totalMinutes >= openMinutes && totalMinutes <= lastOrderMinutes;

    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const hh = String(madridTime.getHours()).padStart(2, '0');
    const mm = String(madridTime.getMinutes()).padStart(2, '0');

    return {
      is_open: isOpen,
      current_time: `${hh}:${mm}`,
      day_of_week: dayNames[day],
      hours_today: isFriSat ? '19:00 - 23:30 (último pedido a las 23:15)' : '19:00 - 23:00 (último pedido a las 22:45)',
    };
  } catch (err) {
    console.error('Error comprobando el horario:', err.message);
    // Ante la duda, mejor asumir que está abierto que rechazar un pedido válido por un fallo técnico.
    return { is_open: true, current_time: null, day_of_week: null, hours_today: null, error: 'CHECK_FAILED' };
  }
}

module.exports = { checkHours };
