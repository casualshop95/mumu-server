// printQueue.js
// Cola simple en memoria. Cuando se confirma un pedido, se añade aquí un "ticket"
// listo para imprimir. El agente local (Termux, en la tablet junto a la impresora)
// consulta esta cola periódicamente y marca cada ticket como impreso tras enviarlo
// a la impresora por la red local.
//
// NOTA: al ser en memoria, si Railway reinicia el servidor se perderían los tickets
// aún no impresos. Para el volumen de un solo restaurante esto es un riesgo bajo,
// pero si en el futuro hace falta más fiabilidad, se puede persistir a un archivo
// o a una base de datos pequeña (SQLite, Redis, etc.).

let queue = [];
let nextId = 1;

function enqueue(order) {
  const job = {
    id: nextId++,
    created_at: new Date().toISOString(),
    printed: false,
    order,
  };
  queue.push(job);
  // Limpieza: no dejar crecer la cola indefinidamente con tickets ya impresos antiguos.
  queue = queue.filter((j) => !j.printed || Date.now() - new Date(j.created_at).getTime() < 24 * 60 * 60 * 1000);
  return job;
}

function getPending() {
  return queue.filter((j) => !j.printed);
}

function markPrinted(id) {
  const job = queue.find((j) => j.id === id);
  if (job) job.printed = true;
  return !!job;
}

module.exports = { enqueue, getPending, markPrinted };
