require('dotenv').config();
const express = require('express');
const { calculateTotal } = require('./calculateTotal');
const { createLoyverseReceipt } = require('./loyverseClient');
const { parseItemsList } = require('./catalog');
const { enqueue, getPending, markPrinted } = require('./printQueue');
const { isDuplicate } = require('./dedupe');
const { cacheCalculation, getCachedCalculation } = require('./orderCache');
const { checkHours } = require('./hours');
const monitor = require('./monitor');

const app = express();
app.use(express.json());
app.use(express.static('public'));
const manualOrderRouter = require('./manualOrder');
app.use(manualOrderRouter);
const publicOrderRouter = require('./publicOrder');
app.use(publicOrderRouter);

// --- Sistema de carga de cocina (automático + niveles manuales) ---
// El estado vive en loadState.js (compartido con la web pública).
const loadState = require('./loadState');
const registerNewOrder = loadState.registerNewOrder;

app.get('/tools/check-load', (req, res) => {
  const s = loadState.getStatus();
  res.json({
    is_closed: s.is_closed,
    closure_message: s.closure_message,
    is_paused: s.is_paused,
    load_level: s.load_level,
    orders_last_30min: s.orders_last_30min,
    delivery_message: s.delivery_message,
    pickup_message: s.pickup_message,
  });
});

// Estado público para las páginas web (tiempos estimados y pausa). Sin datos sensibles.
app.get('/public/status', (req, res) => {
  const s = loadState.getStatus();
  const lang = req.query.lang === 'en' ? 'en' : 'es';
  res.set('Cache-Control', 'no-store');
  res.json({
    is_closed: s.is_closed,
    closure_message: loadState.closureMessage(loadState.getClosure(), lang),
    is_paused: s.is_paused,
    busy: s.busy,
    delivery_time: s.delivery_time,
    pickup_time: s.pickup_time,
  });
});

// Enlaces sencillos para el personal (guardar como marcador en el móvil).
// Protegidos por la variable de entorno ADMIN_SECRET.
app.get('/admin/set-load', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const level = req.query.level;
  if (!loadState.setLevel(level)) {
    return res.status(400).send('Nivel no válido. Usa: normal, level1 o level2.');
  }
  const m = loadState.LOAD_LEVEL_MESSAGES[level];
  const exp = loadState.levelExpiry();
  const aviso = exp ? `\nVolverá a "normal" automáticamente al cerrar (${new Date(exp).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}).` : '';
  res.send(`Nivel de carga actualizado a: ${level}\n${m.delivery}\n${m.pickup}${aviso}`);
});

app.get('/admin/pause', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const minutes = Number(req.query.minutes) || 120;
  const until = loadState.pause(minutes);
  res.send(`Pedidos pausados (voz y web) durante ${minutes} minutos (hasta las ${new Date(until).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })}).`);
});

// Cierre del local (vacaciones, motivos técnicos...). Ejemplos:
//   /admin/close?key=...&reason=vacaciones&until=2026-12-01   (reabre el 1 dic a las 00:00)
//   /admin/close?key=...&reason=tecnico&hours=3               (cierra 3 horas)
//   /admin/close?key=...&reason=Reformas                      (sin fecha: hasta /admin/open)
app.get('/admin/close', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  let until = 0;
  if (req.query.until) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.query.until).trim());
    if (!m) return res.status(400).send('Fecha no válida. Usa until=AAAA-MM-DD, por ejemplo until=2026-12-01.');
    until = loadState.madridLocalToMs(+m[1], +m[2], +m[3], 0, 0);
    if (until <= Date.now()) return res.status(400).send('La fecha tiene que ser futura.');
  } else if (req.query.hours) {
    const h = Number(req.query.hours);
    if (!(h > 0 && h <= 24 * 60)) return res.status(400).send('hours no válido.');
    until = Date.now() + h * 3600 * 1000;
  }
  const c = loadState.closeVenue(req.query.reason, until);
  const msg = loadState.closureMessage(c);
  monitor.notify(`🔒 Local CERRADO (web + teléfono): ${msg}${until ? '' : ' Sin fecha: hasta /admin/open.'}`).catch(() => {});
  res.send(`Local cerrado. Los clientes verán: "${msg}"\n${until ? 'Se reabrirá solo el ' + new Date(until).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) + '.' : 'Sin fecha de reapertura: ábrelo con /admin/open.'}`);
});

app.get('/admin/open', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  loadState.reopenVenue();
  monitor.notify('🔓 Local REABIERTO (vuelve el horario normal).').catch(() => {});
  res.send('Local reabierto. Vuelve el horario normal.');
});

// Estado para el panel (JSON, protegido).
app.get('/admin/state', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'forbidden' });
  const s = loadState.getStatus();
  const c = loadState.getClosure();
  const hours = loadState.applyClosure(checkHours());
  res.set('Cache-Control', 'no-store');
  res.json({
    is_open: !!hours.is_open,
    closure: c ? { reason: c.reason, until: c.until || 0 } : null,
    load_level: s.load_level,
    is_paused: s.is_paused,
    paused_until: s.paused_until,
    orders_last_30min: s.orders_last_30min,
  });
});

// Panel con botones para el móvil: /admin/panel?key=...
const PANEL_HTML = "<!doctype html>\n<html lang=\"uk\"><head><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"robots\" content=\"noindex,nofollow\">\n<title>MU-MU / HOT SPOT</title>\n<style>\n:root{--bg:#121214;--card:#1c1c20;--line:#2e2e35;--text:#f2f2f2;--mut:#9a9aa5;--red:#e53935;--grn:#2e9e5b;--amb:#e0a21b;--blu:#3b82f6}\n*{box-sizing:border-box}\nbody{margin:0;background:var(--bg);color:var(--text);font:16px/1.4 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;padding:16px;max-width:560px;margin:0 auto}\nh1{font-size:20px;margin:4px 0 14px}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}#lsw{display:flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;flex:none;margin-top:4px}#lsw button{min-height:0;border:0;border-radius:0;background:transparent;color:var(--mut);padding:7px 11px;font-size:12px}#lsw button.on{background:#fff;color:#000}\n.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px}\n.card h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin:0 0 10px}\n.st{display:grid;gap:8px}\n.pill{display:flex;justify-content:space-between;gap:10px;font-size:15px}\n.pill b{text-align:right}\n.ok{color:#5fd38d}.bad{color:#ff7b78}.warn{color:#f3c04a}\n.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}\n.row.two{grid-template-columns:1fr 1fr}\n.row.four{grid-template-columns:repeat(4,1fr)}\nbutton{font:inherit;font-weight:600;color:#fff;background:#2b2b31;border:1px solid var(--line);border-radius:12px;padding:14px 8px;min-height:52px;cursor:pointer;line-height:1.2}\nbutton:active{transform:scale(.98)}\nbutton small{display:block;font-weight:400;color:#ddd;opacity:.8;font-size:12px;margin-top:2px}\n.b-grn{background:var(--grn);border-color:var(--grn)}\n.b-amb{background:#8a6410;border-color:var(--amb)}\n.b-red{background:#a82320;border-color:var(--red)}\n.b-blu{background:#1f4fa8;border-color:var(--blu)}\n.cur{outline:3px solid #fff}\nlabel{display:block;font-size:13px;color:var(--mut);margin:12px 0 6px}\ninput,select{width:100%;font:inherit;color:var(--text);background:#0f0f12;border:1px solid var(--line);border-radius:10px;padding:12px}\n.sp{height:8px}\n#toast{position:fixed;left:16px;right:16px;bottom:16px;max-width:528px;margin:0 auto;background:#000;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:14px;white-space:pre-line;display:none}\n.note{font-size:13px;color:var(--mut);margin:8px 0 0}\n</style></head><body>\n<div class=\"top\"><h1 data-t>Пульт: MU-MU GRILL · HOT SPOT</h1><div id=\"lsw\"><button data-l=\"uk\">УКР</button><button data-l=\"es\">ESP</button></div></div>\n\n<div class=\"card\"><h2 data-t>Зараз</h2><div class=\"st\" id=\"st\"><div class=\"pill\"><span>Завантаження…</span></div></div></div>\n\n<div class=\"card\"><h2 data-t>Завантаженість кухні</h2>\n<div class=\"row\">\n<button class=\"b-grn\" data-load=\"normal\" id=\"l-normal\"><span data-t>Нормально</span><small data-t>40–50 хв</small></button>\n<button class=\"b-amb\" data-load=\"level1\" id=\"l-level1\"><span data-t>Багато</span><small data-t>1 год – 1:15</small></button>\n<button class=\"b-red\" data-load=\"level2\" id=\"l-level2\"><span data-t>Дуже багато</span><small data-t>1:15 – 1:30</small></button>\n</div>\n<p class=\"note\" data-t>Рівень сам скидається на «Нормально» при закритті кухні.</p></div>\n\n<div class=\"card\"><h2 data-t>Пауза замовлень</h2>\n<div class=\"row four\">\n<button class=\"b-amb\" data-pause=\"15\"><span data-t>15 хв</span></button>\n<button class=\"b-amb\" data-pause=\"30\"><span data-t>30 хв</span></button>\n<button class=\"b-amb\" data-pause=\"60\"><span data-t>1 год</span></button>\n<button class=\"b-amb\" data-pause=\"120\"><span data-t>2 год</span></button>\n</div><div class=\"sp\"></div>\n<button class=\"b-grn\" style=\"width:100%\" id=\"resume\" data-t>▶ Зняти паузу</button></div>\n\n<div class=\"card\"><h2 data-t>Закриття закладу</h2>\n<label data-t>Відпустка до дати (відкриємось цього дня о 00:00)</label>\n<input type=\"date\" id=\"vdate\">\n<div class=\"sp\"></div>\n<button class=\"b-red\" style=\"width:100%\" id=\"vac\" data-t>🏖 Закрити: відпустка</button>\n\n<label data-t>Технічна причина, на скільки годин</label>\n<select id=\"thours\"><option>1</option><option selected>2</option><option>3</option><option>6</option><option>12</option><option>24</option></select>\n<div class=\"sp\"></div>\n<button class=\"b-red\" style=\"width:100%\" id=\"tech\" data-t>🔧 Закрити: технічні причини</button>\n\n<label data-t>Свій текст (необов'язково дата)</label>\n<input type=\"text\" id=\"ctext\" placeholder=\"Напр.: Reformas\" maxlength=\"100\">\n<div class=\"sp\"></div>\n<input type=\"date\" id=\"cdate\">\n<div class=\"sp\"></div>\n<button class=\"b-red\" style=\"width:100%\" id=\"custom\" data-t>Закрити зі своїм текстом</button>\n\n<div class=\"sp\"></div><div class=\"sp\"></div>\n<button class=\"b-grn\" style=\"width:100%\" id=\"open\" data-t>🔓 Відкрити заклад</button>\n<p class=\"note\" data-t>Для довгих відпусток надійніше змінні CLOSED_UNTIL / CLOSED_REASON у Railway: після оновлення коду закриття з пульта може скинутися.</p></div>\n\n<div id=\"toast\"></div>\n<script>\nvar KEY=new URLSearchParams(location.search).get('key')||'';\nvar $=function(i){return document.getElementById(i)};\nvar ES={\n'Пульт: MU-MU GRILL · HOT SPOT':'Panel: MU-MU GRILL · HOT SPOT',\n'Зараз':'Ahora','Завантаженість кухні':'Carga de cocina','Нормально':'Normal','40–50 хв':'40–50 min',\n'Багато':'Mucha','1 год – 1:15':'1 h – 1:15','Дуже багато':'Muchísima','1:15 – 1:30':'1:15 – 1:30',\n'Рівень сам скидається на «Нормально» при закритті кухні.':'El nivel vuelve solo a «Normal» al cerrar la cocina.',\n'Пауза замовлень':'Pausa de pedidos','15 хв':'15 min','30 хв':'30 min','1 год':'1 h','2 год':'2 h',\n'▶ Зняти паузу':'▶ Quitar la pausa','Закриття закладу':'Cierre del local',\n'Відпустка до дати (відкриємось цього дня о 00:00)':'Vacaciones hasta la fecha (reabrimos ese día a las 00:00)',\n'🏖 Закрити: відпустка':'🏖 Cerrar: vacaciones',\n'Технічна причина, на скільки годин':'Motivo técnico, cuántas horas',\n'🔧 Закрити: технічні причини':'🔧 Cerrar: motivos técnicos',\n\"Свій текст (необов'язково дата)\":'Texto propio (fecha opcional)',\n'Напр.: Reformas':'Ej.: Reformas',\n'Закрити зі своїм текстом':'Cerrar con texto propio','🔓 Відкрити заклад':'🔓 Abrir el local',\n'Для довгих відпусток надійніше змінні CLOSED_UNTIL / CLOSED_REASON у Railway: після оновлення коду закриття з пульта може скинутися.':'Para vacaciones largas es más seguro usar las variables CLOSED_UNTIL / CLOSED_REASON en Railway: al actualizar el código, el cierre hecho desde el panel puede perderse.',\n'Заклад':'Local','ЗАКРИТО':'CERRADO','відкрито':'abierto','зараз зачинено за графіком':'cerrado ahora según el horario',\n'Причина':'Motivo','Відкриємось':'Reabrimos','коли натиснете «Відкрити»':'cuando pulses «Abrir»',\n'Завантаженість':'Carga','Багато замовлень':'Muchos pedidos','Пауза':'Pausa','немає':'ninguna','до ':'hasta ',\n'Замовлень за 30 хв':'Pedidos en 30 min','Стан':'Estado',\n'не вдалося отримати (перевірте ключ у посиланні)':'no se pudo obtener (revisa la clave del enlace)',\n'Оберіть дату, коли відкриємось':'Elige la fecha de reapertura','Впишіть текст причини':'Escribe el motivo',\n'Поставити замовлення на паузу на ':'¿Pausar los pedidos durante ',\n'Закрити заклад на сайтах і телефоні (відпустка)?':'¿Cerrar el local en webs y teléfono (vacaciones)?',\n'Закрити заклад на ':'¿Cerrar el local durante ',' год (технічні причини)?':' h (motivos técnicos)?',\n'Закрити заклад з цим текстом для клієнтів?':'¿Cerrar el local con este texto para los clientes?',\n'Відкрити заклад?':'¿Abrir el local?',\n'Немає зв’язку з сервером':'Sin conexión con el servidor'\n};\nvar PL='uk';try{var sv=localStorage.getItem('plang');if(sv==='uk'||sv==='es')PL=sv}catch(e){}\nfunction U(s){return (PL==='es'&&ES[s])||s}\nfunction applyT(){\n  document.documentElement.lang=PL;\n  document.querySelectorAll('[data-t]').forEach(function(el){if(el.dataset.u===undefined)el.dataset.u=el.innerHTML.trim();el.innerHTML=U(el.dataset.u)});\n  var ct=$('ctext');if(ct)ct.placeholder=U('Напр.: Reformas');\n  document.querySelectorAll('#lsw button').forEach(function(b){b.classList.toggle('on',b.dataset.l===PL)});\n}\n\nfunction toast(t){var e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){e.style.display='none'},6000)}\nfunction call(path,params,ask){\n  if(ask&&!confirm(ask))return;\n  var q='key='+encodeURIComponent(KEY);\n  for(var k in params){if(params[k]!==''&&params[k]!=null)q+='&'+k+'='+encodeURIComponent(params[k])}\n  fetch('/admin/'+path+'?'+q,{cache:'no-store'}).then(function(r){return r.text().then(function(t){toast((r.ok?'✅ ':'⚠️ ')+t);refresh()})}).catch(function(){toast('⚠️ '+U('Немає зв’язку з сервером'))});\n}\nfunction fmt(ms){return new Date(ms).toLocaleString(PL==='es'?'es-ES':'uk-UA',{timeZone:'Europe/Madrid',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}\nfunction pill(l,v,c){return '<div class=\"pill\"><span>'+l+'</span><b class=\"'+(c||'')+'\">'+v+'</b></div>'}\nvar LV={normal:'Нормально',level1:'Багато замовлень',level2:'Дуже багато'};\nfunction refresh(){\n  fetch('/admin/state?key='+encodeURIComponent(KEY),{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(s){\n    var h='';\n    h+=pill(U('Заклад'),U(s.closure?'ЗАКРИТО':(s.is_open?'відкрито':'зараз зачинено за графіком')),s.closure?'bad':(s.is_open?'ok':'warn'));\n    if(s.closure){h+=pill(U('Причина'),s.closure.reason.replace(/</g,'&lt;'));h+=pill(U('Відкриємось'),s.closure.until?fmt(s.closure.until):U('коли натиснете «Відкрити»'))}\n    h+=pill(U('Завантаженість'),U(LV[s.load_level]||s.load_level),s.load_level==='normal'?'ok':'warn');\n    h+=pill(U('Пауза'),s.is_paused?U('до ')+fmt(s.paused_until):U('немає'),s.is_paused?'bad':'ok');\n    h+=pill(U('Замовлень за 30 хв'),String(s.orders_last_30min));\n    $('st').innerHTML=h;\n    ['normal','level1','level2'].forEach(function(k){$('l-'+k).classList.toggle('cur',s.load_level===k)});\n  }).catch(function(){$('st').innerHTML=pill(U('Стан'),U('не вдалося отримати (перевірте ключ у посиланні)'),'bad')});\n}\ndocument.querySelectorAll('[data-load]').forEach(function(b){b.onclick=function(){call('set-load',{level:b.dataset.load})}});\ndocument.querySelectorAll('[data-pause]').forEach(function(b){b.onclick=function(){call('pause',{minutes:b.dataset.pause},U('Поставити замовлення на паузу на ')+b.textContent+'?')}});\n$('resume').onclick=function(){call('resume',{})};\n$('vac').onclick=function(){if(!$('vdate').value){toast(U('Оберіть дату, коли відкриємось'));return}call('close',{reason:'vacaciones',until:$('vdate').value},U('Закрити заклад на сайтах і телефоні (відпустка)?'))};\n$('tech').onclick=function(){call('close',{reason:'tecnico',hours:$('thours').value},U('Закрити заклад на ')+$('thours').value+U(' год (технічні причини)?'))};\n$('custom').onclick=function(){if(!$('ctext').value.trim()){toast(U('Впишіть текст причини'));return}call('close',{reason:$('ctext').value.trim(),until:$('cdate').value},U('Закрити заклад з цим текстом для клієнтів?'))};\n$('open').onclick=function(){call('open',{},U('Відкрити заклад?'))};\ndocument.getElementById('lsw').onclick=function(e){var b=e.target.closest('button');if(!b)return;PL=b.dataset.l;try{localStorage.setItem('plang',PL)}catch(x){}applyT();refresh()};\napplyT();refresh();setInterval(refresh,30000);\n</script></body></html>\n";
app.get('/admin/panel', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  res.set('Cache-Control', 'no-store');
  res.type('html').send(PANEL_HTML);
});

app.get('/admin/resume', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  loadState.resume();
  res.send('Pedidos reanudados.');
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/tools/check-hours', (req, res) => {
  res.json(loadState.applyClosure(checkHours(), req.query.lang === 'en' ? 'en' : 'es'));
});

app.post('/tools/calculate-total', (req, res) => {
  try {
    console.log('=== ДАНІ ВІД HAPP AI ===');
    console.log(JSON.stringify(req.body, null, 2));

    const params = req.body.parameters || req.body.arguments || req.body.args || req.body;
    const items = parseItemsList(params.items || []);

    console.log('=== ITEMS PARSEADOS ===');
    console.log(JSON.stringify(items, null, 2));

    const result = calculateTotal({
      service_type: params.service_type || 'delivery',
      items,
    });

    console.log('=== РЕЗУЛЬТАТ РОЗРАХУНКУ ===');
    console.log(JSON.stringify(result, null, 2));

    // Si el cálculo fue exitoso (sin artículos desconocidos) y tenemos un
    // teléfono, lo guardamos como fuente de verdad para create_order — así
    // evitamos que una reconstrucción inconsistente del pedido en la llamada
    // posterior cambie lo que ya se le confirmó al cliente.
    if (!result.error && (!result.unknown_items || result.unknown_items.length === 0) && params.customer_phone) {
      cacheCalculation(params.customer_phone, {
        service_type: params.service_type || 'delivery',
        lines: result.lines,
        total: result.total,
        delivery_fee: result.delivery_fee,
      });
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Помилка в /tools/calculate-total:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/webhook/order-confirmed', async (req, res) => {
  try {
    const order = req.body.parameters || req.body.arguments || req.body.args || req.body;
    order.items = parseItemsList(order.items || []);

    console.log('=== ПІДТВЕРДЖЕНЕ ЗАМОВЛЕННЯ (parsed) ===');
    console.log(JSON.stringify(order, null, 2));

    // Protección 3: si create_order llega con items VACÍOS (llamada incompleta/streaming),
    // usamos el último calculate_total verificado para este teléfono como red de
    // seguridad. NUNCA sobrescribimos datos que create_order sí trae completos —
    // el cliente puede haber corregido el pedido después de aquel cálculo, y en
    // ese caso create_order es la fuente más reciente y correcta, no el caché.
    const cached = getCachedCalculation(order.customer_phone);
    if (cached && (!Array.isArray(order.items) || order.items.length === 0)) {
      console.warn('items vacío en create_order — usando el último calculate_total verificado como red de seguridad.');
      order.items = (cached.lines || []).map((line) => ({
        name: line.name,
        quantity: line.quantity,
        modifications: line.modifications || [],
        extras: (line.extras || []).map((e) => e.name),
      }));
      order.total = cached.total;
      order.delivery_fee = cached.delivery_fee;
    }

    // Protección 1: si items llega vacío, es casi seguro una llamada incompleta
    // (streaming a medio terminar) — la rechazamos sin encolar nada ni tocar Loyverse.
    if (!Array.isArray(order.items) || order.items.length === 0) {
      console.warn('Pedido descartado: items vacío (posible llamada incompleta/streaming).');
      return res.status(200).json({ success: false, error: 'EMPTY_ITEMS_IGNORED' });
    }

    // Protección 4: recalculamos el total AQUÍ MISMO a partir de los items que
    // realmente trae este create_order — nunca confiamos en el número que diga
    // el agente (ni en un cálculo cacheado de una llamada anterior, que puede
    // haber quedado obsoleto si el pedido cambió después). Así el total del
    // ticket y de Loyverse siempre coincide matemáticamente con los artículos
    // que se están registrando de verdad.
    const freshCalc = calculateTotal({ service_type: order.service_type, items: order.items });
    if (!freshCalc.error) {
      if (order.total !== undefined && Number(freshCalc.total) !== Number(order.total)) {
        console.warn(`El total recibido (${order.total}) no coincide con el recalculado a partir de los items (${freshCalc.total}) — usando el recalculado.`);
      }
      order.total = freshCalc.total;
      order.delivery_fee = freshCalc.delivery_fee;
    } else {
      console.warn('No se pudo recalcular el total (artículos no reconocidos) — se mantiene el total recibido como último recurso.');
    }

    // Protección 2: si un pedido con el mismo teléfono + mismo total ya se procesó
    // hace pocos segundos, es casi seguro la misma llamada disparada varias veces
    // (visto con Retell: 2-3 llamadas en menos de 30ms con datos parciales distintos).
    if (isDuplicate(order)) {
      console.warn('Pedido descartado: duplicado detectado en los últimos 20s.', JSON.stringify(order));
      return res.status(200).json({ success: false, error: 'DUPLICATE_ORDER_IGNORED' });
    }

    // Encolamos el ticket de cocina SIEMPRE, incluso si Loyverse falla después —
    // la cocina necesita el pedido físico independientemente de la contabilidad.
    const printJob = enqueue(order);
    console.log(`Ticket #${printJob.id} añadido a la cola de impresión.`);

    const accessToken = process.env.LOYVERSE_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Falta LOYVERSE_ACCESS_TOKEN en las variables de entorno.');
      return res.status(200).json({ success: false, error: 'MISSING_LOYVERSE_TOKEN' });
    }

    const result = await createLoyverseReceipt(order, accessToken);

    if (!result.success) {
      console.error('Error creando el recibo en Loyverse:', result);
      return res.status(200).json({ success: false, ...result });
    }

    console.log('Recibo creado en Loyverse:', result.receipt.receipt_number);
    registerNewOrder();
    return res.status(200).json({
      success: true,
      receipt_number: result.receipt.receipt_number,
      unmatched_items: result.notFound || [],
    });
  } catch (err) {
    console.error('Error en /webhook/order-confirmed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Página principal: según el dominio se muestra la carta de cada marca.
// (HOT SPOT: añadir aquí su dominio cuando esté comprado)
const PIZZA_HOSTS = ['hotspotpizza.es', 'www.hotspotpizza.es'];
app.get('/favicon.ico', (req, res) => {
  const host = String(req.hostname || '').toLowerCase();
  const icon = PIZZA_HOSTS.includes(host) ? 'fav-hotspot.ico' : 'fav-mumu.ico';
  res.sendFile('images/' + icon, { root: 'public' });
});

app.get('/', (req, res) => {
  const host = String(req.hostname || '').toLowerCase();
  const page = PIZZA_HOSTS.includes(host) ? 'pizza-order.html' : 'public-order.html';
  res.sendFile(page, { root: 'public' });
});

// -----------------------------------------------------------------------
// COLA DE IMPRESIÓN LOCAL
//    El agente Termux (en la tablet junto a la impresora) consulta esto
//    periódicamente y envía los tickets pendientes directamente a la
//    impresora por la red local, sin depender de Loyverse.
// -----------------------------------------------------------------------
app.get('/print-queue', (req, res) => {
  monitor.touchPoll(); // la consulta del agente sirve de "latido"
  res.status(200).json({ jobs: getPending() });
});

// Estado para el personal (enlace para guardar como marcador).
app.get('/admin/status', (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  res.json(Object.assign({ closure: loadState.getClosure() }, monitor.status(getPending)));
});

// Prueba del aviso: abre /admin/test-telegram?key=... y debe llegarte un mensaje.
app.get('/admin/test-telegram', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET) return res.status(403).send('Clave incorrecta.');
  const ok = await monitor.notify('✅ Prueba: los avisos de MU-MU GRILL funcionan.');
  res.send(ok ? 'Enviado. Mira Telegram.' : 'No se pudo enviar. Revisa TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Railway.');
});

app.post('/print-queue/:id/ack', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const found = markPrinted(id);
  res.status(200).json({ success: found });
});

// Запускаємо сервер ТІЛЬКИ ОДИН РАЗ на порту з process.env.PORT або 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  monitor.startWatchdog(getPending);
});
