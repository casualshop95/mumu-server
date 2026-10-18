// monitor.js
// Vigilancia de pedidos: avisos por Telegram + comprobación de que la tablet
// de cocina (agente de impresión) está viva y de que los tickets se imprimen.
//
// Variables de entorno (Railway):
//   TELEGRAM_BOT_TOKEN  token del bot (@BotFather)
//   TELEGRAM_CHAT_ID    id del chat/grupo que recibe los avisos
// Sin ellas, todo sigue funcionando; solo se escribe un aviso en el log.

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { checkHours } = require('./hours');

const AGENT_OFFLINE_MS = 120 * 1000;   // sin consultar la cola en 2 min => agente caído
const STUCK_FIRST_MS = 3 * 60 * 1000;  // ticket sin imprimir > 3 min => aviso
const STUCK_REMIND_MS = 10 * 60 * 1000; // y recordatorio a los 10 min
const BOOT_GRACE_MS = 90 * 1000;       // margen tras reiniciar el servidor

const bootAt = Date.now();
let lastPollAt = 0;
let offlineAlerted = false;
const stuckAlerts = new Map(); // job.id -> { first: bool, remind: bool }

function notify(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[monitor] Telegram no configurado; aviso omitido:', text.split('\n')[0]);
    return Promise.resolve(false);
  }
  const base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
  const url = new URL(`${base}/bot${token}/sendMessage`);
  const body = JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4000) });
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve) => {
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000,
    }, (res) => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode !== 200) console.error('[monitor] Telegram respondió', res.statusCode);
        resolve(res.statusCode === 200);
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => { console.error('[monitor] Error enviando a Telegram:', err.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

function touchPoll() {
  lastPollAt = Date.now();
  if (offlineAlerted) {
    offlineAlerted = false;
    notify('✅ La tablet de cocina vuelve a estar en línea.');
  }
}

function isAgentOnline() {
  if (!lastPollAt) return Date.now() - bootAt < BOOT_GRACE_MS;
  return Date.now() - lastPollAt < AGENT_OFFLINE_MS;
}

function formatOrder(order, jobId) {
  const o = order || {};
  const lines = [];
  const where = o.brand === 'hot_spot' ? 'HOT SPOT' : 'MU-MU GRILL';
  lines.push(`🧾 NUEVO PEDIDO${jobId ? ' #' + jobId : ''} · ${where}`);
  lines.push(o.service_type === 'delivery' ? '🛵 A DOMICILIO' : '🛍 RECOGIDA');
  if (o.customer_name) lines.push(`👤 ${o.customer_name}`);
  if (o.customer_phone) lines.push(`📞 ${o.customer_phone}`);
  if (o.delivery_address) lines.push(`📍 ${o.delivery_address}`);
  (o.items || []).forEach((it) => {
    const extra = []
      .concat(it.modifications || [])
      .concat((it.extras || []).map((e) => '+' + (e.name || e)));
    lines.push(`• ${it.quantity || 1}× ${it.name}${extra.length ? ' (' + extra.join(', ') + ')' : ''}`);
  });
  if (o.delivery_notes) lines.push(`📝 ${o.delivery_notes}`);
  const pay = o.payment_method === 'cash' ? 'efectivo' : o.payment_method === 'card' ? 'tarjeta' : (o.payment_method || '');
  lines.push(`💶 Total ${o.total != null ? Number(o.total).toFixed(2) + ' €' : '?'}${pay ? ' · ' + pay : ''}`);
  if (o.payment_method === 'cash' && o.cash_amount) {
    lines.push(`   Paga con ${Number(o.cash_amount).toFixed(2)} € (cambio ${(Number(o.cash_amount) - Number(o.total || 0)).toFixed(2)} €)`);
  }
  return lines.join('\n');
}

function notifyNewOrder(job) {
  return notify(formatOrder(job.order, job.id));
}

function reportProblem(text) {
  return notify('⚠️ ' + text);
}

// Comprueba cada 30 s: (1) agente de impresión vivo (solo en horario abierto),
// (2) tickets pendientes sin imprimir demasiado tiempo.
function startWatchdog(getPending) {
  const timer = setInterval(() => {
    try {
      let open = true;
      try { open = checkHours().is_open; } catch (e) { /* ante la duda, vigilar */ }

      if (open && !isAgentOnline() && !offlineAlerted) {
        offlineAlerted = true;
        notify('🚨 La tablet de cocina NO consulta la cola desde hace más de 2 minutos. ' +
               'Los pedidos no se imprimen. Revisa la tablet (Wi-Fi, Termux).');
      }

      const pending = getPending();
      const now = Date.now();
      const pendingIds = new Set(pending.map((j) => j.id));
      for (const id of stuckAlerts.keys()) if (!pendingIds.has(id)) stuckAlerts.delete(id);
      for (const job of pending) {
        const age = now - new Date(job.created_at).getTime();
        const st = stuckAlerts.get(job.id) || { first: false, remind: false };
        if (age >= STUCK_REMIND_MS && !st.remind) {
          st.remind = true; st.first = true;
          notify(`🚨 El pedido #${job.id} lleva ${Math.round(age / 60000)} min SIN IMPRIMIR. Revisa la impresora (papel, encendida, Wi-Fi).`);
        } else if (age >= STUCK_FIRST_MS && !st.first) {
          st.first = true;
          notify(`⚠️ El pedido #${job.id} lleva más de 3 min sin imprimirse. Revisa la impresora.`);
        }
        stuckAlerts.set(job.id, st);
      }
    } catch (err) {
      console.error('[monitor] Error en la vigilancia:', err.message);
    }
  }, 30 * 1000);
  if (timer.unref) timer.unref();
  return timer;
}

function status(getPending) {
  const pending = getPending();
  return {
    agent_online: isAgentOnline(),
    last_poll_seconds_ago: lastPollAt ? Math.round((Date.now() - lastPollAt) / 1000) : null,
    pending_tickets: pending.length,
    telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  };
}

module.exports = { notify, notifyNewOrder, reportProblem, touchPoll, isAgentOnline, startWatchdog, status, formatOrder };
