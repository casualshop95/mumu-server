# MU-MU GRILL — Order Server

Servidor mínimo en Node.js/Express que da soporte al agente de voz de Happ:

1. `POST /tools/calculate-total` — calcula el total del pedido (esto es lo que conectas
   como el tool `calculate_total` en Happ).
2. `POST /webhook/order-confirmed` — recibe el pedido ya confirmado por el agente
   (esqueleto pendiente de conectar con Loyverse, ver más abajo).

## Cómo probarlo en local

```bash
npm install
npm start
```

Luego, en otra terminal:

```bash
curl -X POST http://localhost:3000/tools/calculate-total \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "delivery",
    "items": [
      { "name": "Cheddar Bacon", "quantity": 1, "modifications": ["sin cebolla"], "extras": [] }
    ]
  }'
```

Deberías recibir un JSON con `subtotal`, `delivery_fee` y `total`.

## Cómo desplegarlo en Railway (recomendado, más simple)

1. Crea una cuenta en https://railway.app (puedes usar tu GitHub).
2. Sube esta carpeta a un repositorio de GitHub (o usa `railway up` desde la CLI sin GitHub).
3. En Railway: "New Project" → "Deploy from GitHub repo" → selecciona el repo.
4. Railway detecta Node.js automáticamente y ejecuta `npm install && npm start`.
5. En "Settings" → "Networking", genera un dominio público (algo como
   `mumu-grill-server-production.up.railway.app`).
6. Tu URL del tool será: `https://TU-DOMINIO/tools/calculate-total`

## Cómo desplegarlo en Vercel (alternativa)

Vercel es serverless: necesitarías adaptar `index.js` al formato de función serverless
de Vercel (`api/tools/calculate-total.js`). Si prefieres esta opción, dímelo y te preparo
esa versión — para un piloto, Railway es más directo porque el server queda "siempre encendido".

## Pegar la URL en Happ

En el formulario "Додати функцію" de Happ:
- **Посилання на API:** `https://TU-DOMINIO/tools/calculate-total`
- **Параметри:** añade dos parámetros:
  - `service_type` (string, enum: `delivery` / `pickup`)
  - `items` (array de objetos con `name`, `quantity`, `modifications`, `extras`)

## Actualizar el menú o los precios

Todo el catálogo vive en `catalog.js`. Si cambian precios o se añaden platos nuevos,
solo hay que editar ese archivo — no hace falta tocar `calculateTotal.js` ni `index.js`.

## Integración con Loyverse (pendiente)

El endpoint `/webhook/order-confirmed` ahora mismo solo recibe y registra el pedido en el
log del servidor — todavía no lo envía a Loyverse. Para completarlo hace falta:

1. Un **Access Token** de la API de Loyverse (se genera en Loyverse Back Office →
   Integraciones → API Access Token, o vía OAuth si usas una app registrada).
2. El **Store ID** y el **POS Device ID** de tu cuenta de Loyverse.
3. Los **Item Variant IDs** de cada producto del menú en tu inventario de Loyverse — hay
   que mapear cada nombre del catálogo (`catalog.js`) a su ID real en Loyverse. Esto se
   consigue con una llamada a `GET https://api.loyverse.com/v1.0/items` con tu token.

En cuanto tengas esos tres datos, dímelo y completo la función que crea el recibo en
Loyverse (`POST https://api.loyverse.com/v1.0/receipts`).
