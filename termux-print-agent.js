// termux-print-agent.js
// Este script se ejecuta con Node.js DENTRO de Termux, en la tablet Android
// que está en la misma red Wi-Fi que la impresora de cocina.
//
// Cada pocos segundos, pregunta al servidor de MU-MU GRILL (en Railway) si hay
// tickets pendientes de imprimir, y si los hay, los envía directamente a la
// impresora NT-8360L por la red local (puerto 9100, protocolo ESC/POS).
//
// Uso:
//   node termux-print-agent.js
//
// Requiere Node.js instalado en Termux: pkg install nodejs

const net = require('net');
const http = require('http');
const https = require('https');

// --- CONFIGURACIÓN ---
const SERVER_URL = 'https://mumu-server-production.up.railway.app';
const PRINTER_IP = '192.168.1.100';
const PRINTER_PORT = 9100;
const POLL_INTERVAL_MS = 5000;
// ----------------------

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function httpPostJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'POST' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

const KNOWN_MODIFICATIONS = new Set([
  'sin_cebolla', 'sin_cebolla_a_la_plancha', 'sin_cebolla_frita', 'sin_queso',
  'sin_salsa', 'sin_mostaza', 'sin_salsa_de_cereza', 'salsa_aparte',
  'sin_pepinillos', 'sin_tomate', 'sin_lechuga', 'sin_rucula', 'sin_bacon',
  'sin_berenjenas', 'sin_queso_azul', 'sin_champinones', 'sin_salsa_de_tomate',
  'poco_hecha', 'al_punto', 'bien_hecha', 'muy_hecha',
]);

function normalizeText(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isKnownModification(text) {
  return KNOWN_MODIFICATIONS.has(normalizeText(text));
}

// Construye el ticket ESC/POS aquí mismo (copia simplificada de escpos.js del servidor,
// para que este script funcione de forma independiente, sin depender de otros archivos).
function buildTicket(order) {
  const ESC = 0x1b;
  const GS = 0x1d;
  const parts = [];
  const line = (s) => parts.push(Buffer.from(s + '\n', 'utf8'));

  parts.push(Buffer.from([ESC, 0x40])); // init
  parts.push(Buffer.from([ESC, 0x61, 0x01])); // centrar
  parts.push(Buffer.from([GS, 0x21, 0x11])); // tamaño doble
  line('MU-MU GRILL');
  parts.push(Buffer.from([GS, 0x21, 0x00])); // tamaño normal
  line(order.service_type === 'delivery' ? '** DELIVERY **' : '** RECOGIDA **');
  parts.push(Buffer.from([ESC, 0x61, 0x00])); // izquierda
  line('--------------------------------');
  line(`Hora: ${new Date().toLocaleString('es-ES')}`);
  if (order.customer_name) line(`Cliente: ${order.customer_name}`);
  if (order.customer_phone) line(`Tel: ${order.customer_phone}`);
  if (order.service_type === 'delivery') line(`Direccion: ${order.delivery_address || '*** FALTA DIRECCION - LLAMAR AL CLIENTE ***'}`);
  if (order.delivery_notes && String(order.delivery_notes).trim()) {
    parts.push(Buffer.from([ESC, 0x45, 0x01]));
    line(`*** NOTA DE ENTREGA: ${order.delivery_notes} ***`);
    parts.push(Buffer.from([ESC, 0x45, 0x00]));
  }
  if (order.requested_time) line(`Hora solicitada: ${order.requested_time}`);
  line('--------------------------------');

  parts.push(Buffer.from([ESC, 0x45, 0x01])); // negrita on
  for (const item of order.items || []) {
    line(`${item.quantity || 1}x ${item.name}`);
    parts.push(Buffer.from([ESC, 0x45, 0x00])); // negrita off
    const mods = Array.isArray(item.modifications) ? item.modifications : (item.modifications ? [item.modifications] : []);
    const extras = Array.isArray(item.extras) ? item.extras : (item.extras ? [item.extras] : []);
    mods.forEach((m) => {
      const text = typeof m === 'object' && m !== null ? m.name : m;
      if (text && String(text).trim()) {
        const known = isKnownModification(text);
        line(known ? `   - ${text}` : `   *** PETICIÓN ESPECIAL: ${text} ***`);
      }
    });
    extras.forEach((e) => {
      const text = typeof e === 'object' && e !== null ? e.name : e;
      if (text && String(text).trim()) line(`   + ${text}`);
    });
    parts.push(Buffer.from([ESC, 0x45, 0x01])); // negrita on
  }
  parts.push(Buffer.from([ESC, 0x45, 0x00]));

  line('--------------------------------');
  line(`Pago: ${order.payment_method === 'card' ? 'Tarjeta' : 'Efectivo'}`);
  if (order.total !== undefined) {
    parts.push(Buffer.from([ESC, 0x45, 0x01]));
    line(`TOTAL: ${Number(order.total).toFixed(2)} EUR`);
    parts.push(Buffer.from([ESC, 0x45, 0x00]));
  }
  if (order.payment_method === 'cash' && order.cash_amount !== undefined && order.cash_amount !== null && order.cash_amount !== '') {
    const cashAmount = Number(order.cash_amount);
    const total = Number(order.total) || 0;
    line(`Paga con: ${cashAmount.toFixed(2)} EUR`);
    parts.push(Buffer.from([ESC, 0x45, 0x01]));
    line(`CAMBIO: ${(cashAmount - total).toFixed(2)} EUR`);
    parts.push(Buffer.from([ESC, 0x45, 0x00]));
  }
  parts.push(Buffer.from([ESC, 0x64, 3])); // avance de papel
  parts.push(Buffer.from([GS, 0x56, 0x42, 0x00])); // corte

  return Buffer.concat(parts);
}

function printToNetworkPrinter(buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: PRINTER_IP, port: PRINTER_PORT }, () => {
      socket.write(buffer, () => {
        socket.end();
      });
    });
    socket.on('close', resolve);
    socket.on('error', reject);
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error('Timeout conectando a la impresora'));
    });
  });
}

async function pollOnce() {
  try {
    const { jobs } = await httpGetJson(`${SERVER_URL}/print-queue`);
    for (const job of jobs) {
      try {
        console.log(`Imprimiendo ticket #${job.id}...`);
        const ticket = buildTicket(job.order);
        await printToNetworkPrinter(ticket);
        await httpPostJson(`${SERVER_URL}/print-queue/${job.id}/ack`);
        console.log(`Ticket #${job.id} impreso y confirmado.`);
      } catch (err) {
        console.error(`Error imprimiendo ticket #${job.id}:`, err.message);
        // No confirmamos (ack) — se reintentará en el siguiente sondeo.
      }
    }
  } catch (err) {
    console.error('Error consultando la cola de impresión:', err.message);
  }
}

console.log('Agente de impresión MU-MU GRILL iniciado.');
console.log(`Servidor: ${SERVER_URL}`);
console.log(`Impresora: ${PRINTER_IP}:${PRINTER_PORT}`);
setInterval(pollOnce, POLL_INTERVAL_MS);
pollOnce();
