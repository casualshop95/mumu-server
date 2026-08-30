// escpos.js
// Construye el ticket de cocina en formato ESC/POS (el lenguaje que entienden
// la mayoría de impresoras térmicas baratas, incluida la NT-8360L).
// No usamos ninguna librería externa: son solo unos pocos comandos de bytes.

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  DOUBLE_SIZE_ON: Buffer.from([GS, 0x21, 0x11]),
  DOUBLE_SIZE_OFF: Buffer.from([GS, 0x21, 0x00]),
  CUT: Buffer.from([GS, 0x56, 0x42, 0x00]),
  FEED_LINES: (n) => Buffer.from([ESC, 0x64, n]),
};

function textLine(str) {
  return Buffer.concat([Buffer.from(str + '\n', 'utf8')]);
}

function buildKitchenTicket(order) {
  const parts = [];

  parts.push(CMD.INIT);
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.DOUBLE_SIZE_ON);
  parts.push(textLine('MU-MU GRILL'));
  parts.push(CMD.DOUBLE_SIZE_OFF);
  parts.push(textLine(order.service_type === 'delivery' ? '** DELIVERY **' : '** RECOGIDA EN LOCAL **'));
  parts.push(CMD.ALIGN_LEFT);
  parts.push(textLine('--------------------------------'));

  const now = new Date();
  parts.push(textLine(`Hora: ${now.toLocaleString('es-ES')}`));
  if (order.customer_name) parts.push(textLine(`Cliente: ${order.customer_name}`));
  if (order.customer_phone) parts.push(textLine(`Tel: ${order.customer_phone}`));
  if (order.service_type === 'delivery') {
    parts.push(textLine(`Direccion: ${order.delivery_address || '*** FALTA DIRECCION - LLAMAR AL CLIENTE ***'}`));
  }
  if (order.requested_time) parts.push(textLine(`Hora solicitada: ${order.requested_time}`));
  parts.push(textLine('--------------------------------'));

  parts.push(CMD.BOLD_ON);
  for (const item of order.items || []) {
    parts.push(textLine(`${item.quantity || 1}x ${item.name}`));
    parts.push(CMD.BOLD_OFF);
    const mods = Array.isArray(item.modifications) ? item.modifications : (item.modifications ? [item.modifications] : []);
    const extras = Array.isArray(item.extras) ? item.extras : (item.extras ? [item.extras] : []);
    for (const m of mods) {
      const text = typeof m === 'object' && m !== null ? m.name : m;
      if (text && String(text).trim()) parts.push(textLine(`   - ${text}`));
    }
    for (const e of extras) {
      const text = typeof e === 'object' && e !== null ? e.name : e;
      if (text && String(text).trim()) parts.push(textLine(`   + ${text}`));
    }
    parts.push(CMD.BOLD_ON);
  }
  parts.push(CMD.BOLD_OFF);

  parts.push(textLine('--------------------------------'));
  parts.push(textLine(`Pago: ${order.payment_method === 'card' ? 'Tarjeta' : 'Efectivo'}`));
  if (order.total !== undefined) {
    parts.push(CMD.BOLD_ON);
    parts.push(textLine(`TOTAL: ${Number(order.total).toFixed(2)} EUR`));
    parts.push(CMD.BOLD_OFF);
  }
  if (order.payment_method === 'cash' && order.cash_amount !== undefined && order.cash_amount !== null && order.cash_amount !== '') {
    const cashAmount = Number(order.cash_amount);
    const total = Number(order.total) || 0;
    parts.push(textLine(`Paga con: ${cashAmount.toFixed(2)} EUR`));
    parts.push(CMD.BOLD_ON);
    parts.push(textLine(`CAMBIO: ${(cashAmount - total).toFixed(2)} EUR`));
    parts.push(CMD.BOLD_OFF);
  }

  parts.push(CMD.FEED_LINES(3));
  parts.push(CMD.CUT);

  return Buffer.concat(parts);
}

module.exports = { buildKitchenTicket };
