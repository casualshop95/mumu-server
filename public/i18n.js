// i18n.js — idiomas de las páginas públicas (ES por defecto, EN).
// Las claves son el texto original en español; si no hay traducción se muestra el español.
// Los valores que se ENVÍAN al servidor (nombres, modificaciones, extras) siguen siendo en español.
(function () {
  var EN = {
    // --- cabecera / pie ---
    'La hamburguesa que te mereces': 'The burger you deserve',
    'El punto caliente de tu barrio': 'The hot spot of your neighbourhood',
    'Entrega a domicilio 3 € · Gratis a partir de 18 € · Recogida en local': 'Home delivery 3 € · Free over 18 € · Pick-up at the restaurant',
    'CONTACTO': 'CONTACT',
    'Dom–Jue 19:00–23:00 · Vie–Sáb 19:00–23:30': 'Sun–Thu 19:00–23:00 · Fri–Sat 19:00–23:30',
    'Aviso legal': 'Legal notice',
    'Política de privacidad': 'Privacy policy',
    'Ver pedido': 'View order',
    ' producto': ' item', ' productos': ' items',
    // --- categorías ---
    'Hamburguesas': 'Burgers', 'Complementos': 'Sides', 'Bebidas': 'Drinks', 'Postres': 'Desserts', 'Pizzas': 'Pizzas',
    // --- nombres de productos (los de marca no se traducen) ---
    'Alitas de Pollo Fritas': 'Fried Chicken Wings',
    'Alitas de Pollo en Salsa BBQ': 'BBQ Chicken Wings',
    'Alitas de Pollo en Salsa BBQ Picante': 'Spicy BBQ Chicken Wings',
    'Alitas de Pollo en Salsa Buffalo': 'Buffalo Chicken Wings',
    'Patatas Fritas': 'French Fries', 'Patatas Fritas de Gajo': 'Potato Wedges',
    'Nuggets de Pollo': 'Chicken Nuggets', 'Croquetas de Jamón': 'Ham Croquettes',
    'Fanta Naranja': 'Fanta Orange', 'Fanta Limón': 'Fanta Lemon',
    'Aquarius Limón': 'Aquarius Lemon', 'Aquarius Naranja': 'Aquarius Orange',
    'Agua sin gas': 'Still Water', 'Mahou sin alcohol': 'Mahou Alcohol-Free',
    'Tartaleta de Manzana': 'Apple Tartlet', 'Brownie con Nueces': 'Walnut Brownie',
    // --- eslóganes ---
    'El clásico de siempre, sin disfraces.': 'The timeless classic, no disguises.',
    'Cheddar fundido y bacon crujiente: dúo imbatible.': 'Melted cheddar and crispy bacon: an unbeatable duo.',
    'Pollo dorado, crujiente y cremoso a la vez.': 'Golden, crunchy and creamy chicken all at once.',
    'Ahumada, intensa y con mucho carácter.': 'Smoky, intense and full of character.',
    'Una oferta que no podrás rechazar.': 'An offer you can’t refuse.',
    'Dulce, cremosa y con alma de queso de cabra.': 'Sweet, creamy, with the soul of goat cheese.',
    'Pan negro, sabor sin sombras.': 'Black bun, flavour without shadows.',
    'Cerdo desmenuzado, horas de cocción en cada bocado.': 'Pulled pork, hours of slow cooking in every bite.',
    'Un paseo por el bosque: setas, bacon y queso azul.': 'A walk in the woods: mushrooms, bacon and blue cheese.',
    'Alitas fritas sin salsa.': 'Fried wings, no sauce.',
    'Glaseadas con salsa BBQ y sésamo.': 'Glazed with BBQ sauce and sesame.',
    'BBQ con un toque picante.': 'BBQ with a spicy kick.',
    'Clásicas buffalo.': 'Classic buffalo.',
    // --- ingredientes ---
    'Pan brioche, carne de vaca, lechuga, tomate, cebolla, pepinillo, ketchup, mostaza y patatas fritas bastón.': 'Brioche bun, beef patty, lettuce, tomato, onion, pickle, ketchup, mustard and straight-cut fries.',
    'Pan brioche, carne de vaca, lechuga, tomate, cebolla, pepinillo, cheddar, bacon, ketchup, mostaza y patatas fritas bastón.': 'Brioche bun, beef patty, lettuce, tomato, onion, pickle, cheddar, bacon, ketchup, mustard and straight-cut fries.',
    'Pan brioche, hamburguesa de pollo, lechuga, tomate, salsa ranch y patatas fritas bastón.': 'Brioche bun, chicken patty, lettuce, tomato, ranch sauce and straight-cut fries.',
    'Pan brioche, carne de vaca, cebolla salteada, cheddar, bacon, cebolla frita crujiente, salsa smoked BBQ y patatas fritas bastón.': 'Brioche bun, beef patty, sautéed onion, cheddar, bacon, crispy fried onion, smoked BBQ sauce and straight-cut fries.',
    'Pan brioche, carne de vaca, rúcula, tomate, mozzarella, tomate seco, mayonesa con pesto y patatas fritas bastón.': 'Brioche bun, beef patty, rocket, tomato, mozzarella, sun-dried tomato, pesto mayo and straight-cut fries.',
    'Pan brioche, carne de vaca, tomate, queso rulo de cabra, rúcula, cebolla caramelizada, mayonesa de miel y mostaza y patatas fritas bastón.': 'Brioche bun, beef patty, tomato, goat cheese log, rocket, caramelised onion, honey mustard mayo and straight-cut fries.',
    'Pan brioche negro, carne de vaca, cheddar, bacon, mayonesa con parmesano, salsa de cereza y patatas fritas bastón.': 'Black brioche bun, beef patty, cheddar, bacon, parmesan mayo, cherry sauce and straight-cut fries.',
    'Pan brioche, pulled pork, ensalada de col, bacon, cebolla al vinagre, spicy mayo con chipotle y patatas fritas bastón.': 'Brioche bun, pulled pork, coleslaw, bacon, pickled onion, chipotle spicy mayo and straight-cut fries.',
    'Pan brioche, carne de vaca, cebolla caramelizada, bacon, salsa de champiñones y queso azul y patatas fritas bastón.': 'Brioche bun, beef patty, caramelised onion, bacon, mushroom sauce, blue cheese and straight-cut fries.',
    // --- pizzas ---
    'Tomate, mozzarella y albahaca fresca.': 'Tomato, mozzarella and fresh basil.',
    'Mozzarella, jamón cocido y champiñones.': 'Mozzarella, cooked ham and mushrooms.',
    'Jamón de Parma, rúcula, tomate seco y parmesano.': 'Parma ham, rocket, sun-dried tomato and parmesan.',
    'Atún, cebolla roja, tomate cherry y mozzarella.': 'Tuna, red onion, cherry tomato and mozzarella.',
    'Mozzarella y generoso pepperoni.': 'Mozzarella and generous pepperoni.',
    'Mozzarella, carne, bacon y salsa BBQ.': 'Mozzarella, beef, bacon and BBQ sauce.',
    'Cuatro quesos, con toque de queso azul.': 'Four cheeses, with a hint of blue cheese.',
    'Pollo, mozzarella, pesto y tomate cherry.': 'Chicken, mozzarella, pesto and cherry tomato.',
    'Berenjena, champiñones, tomate cherry y mozzarella.': 'Aubergine, mushrooms, cherry tomato and mozzarella.',
    // --- punto, modificaciones, extras ---
    'Poco hecha': 'Rare', 'Al punto': 'Medium', 'Bien hecha': 'Well done',
    'Sin cebolla': 'Without onion', 'Sin pepinillos': 'Without pickles', 'Sin tomate': 'Without tomato',
    'Sin lechuga': 'Without lettuce', 'Sin salsa': 'Without sauce', 'Sin queso': 'Without cheese',
    'Sin bacon': 'Without bacon', 'Sin ketchup': 'Without ketchup', 'Sin mostaza': 'Without mustard',
    'Sin cebolla salteada': 'Without sautéed onion', 'Sin cebolla frita crujiente': 'Without crispy fried onion',
    'Sin rúcula': 'Without rocket', 'Sin tomate seco': 'Without sun-dried tomato',
    'Sin salsa de cereza': 'Without cherry sauce', 'Sin ensalada de col': 'Without coleslaw',
    'Sin salsa de tomate': 'Without tomato sauce', 'Sin champiñones': 'Without mushrooms',
    'Sin queso azul': 'Without blue cheese', 'Sin berenjenas': 'Without aubergine',
    'Extra Bacon': 'Extra Bacon', 'Extra Cheddar': 'Extra Cheddar', 'Extra Mozzarella': 'Extra Mozzarella',
    'Extra Cebolla Caramelizada': 'Extra Caramelised Onion', 'Extra Rulo de Cabra': 'Extra Goat Cheese',
    'Extra Pulled Pork': 'Extra Pulled Pork', 'Extra Salsa Cereza': 'Extra Cherry Sauce',
    'Cambio Patatas Gajo': 'Swap to Potato Wedges', 'Extra Salsa Patatas': 'Extra Fries Sauce',
    // --- hoja de producto / carrito ---
    'Punto de la carne': 'Meat doneness', 'Modificaciones (gratis)': 'Modifications (free)', 'Extras': 'Extras',
    'Comentario (opcional)': 'Comment (optional)', 'Alergias, preferencias…': 'Allergies, preferences…',
    'Añadir · ': 'Add · ', 'Quitar': 'Remove', 'Tu pedido': 'Your order', 'Cerrar': 'Close',
    'Tipo de pedido': 'Order type', 'A domicilio': 'Home delivery', 'Recogida en local': 'Pick-up at the restaurant',
    'Nombre': 'Name', 'Teléfono': 'Phone',
    'Dirección de entrega (calle, número, piso)': 'Delivery address (street, number, floor)',
    'Código postal': 'Postcode', 'Repartimos solo en': 'We only deliver to', 'y': 'and', 'o': 'or',
    'Notas (opcional)': 'Notes (optional)', 'Timbre, indicaciones…': 'Doorbell, directions…',
    'Pago (al recibir / recoger)': 'Payment (on delivery / pick-up)', 'Efectivo': 'Cash', 'Tarjeta': 'Card',
    '¿Con qué billete pagarás?': 'What note will you pay with?', 'Justo': 'Exact', 'Otro': 'Other',
    'Importe, p. ej. 30': 'Amount, e.g. 30',
    'Subtotal': 'Subtotal', 'Envío': 'Delivery', ' (gratis)': ' (free)', 'Total': 'Total',
    'Al enviar el pedido aceptas la': 'By sending your order you accept the', 'y el': 'and the',
    'Enviar pedido': 'Send order', 'Añadir más productos': 'Add more items',
    'Cambio a devolver': 'Change to give back', 'El importe no cubre el total': 'The amount does not cover the total',
    // --- validación ---
    'Escribe tu nombre.': 'Enter your name.', 'Escribe un teléfono válido.': 'Enter a valid phone number.',
    'Escribe la dirección de entrega.': 'Enter the delivery address.',
    'Elige tu código postal': 'Choose your postcode', 'Solo repartimos en esa zona.': 'We only deliver in that area.',
    'Indica con qué billete pagarás (o elige «Justo»).': 'Tell us what note you will pay with (or choose “Exact”).',
    'El importe con el que pagas no cubre el total.': 'The amount you pay with does not cover the total.',
    'Enviando…': 'Sending…',
    'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.': 'Could not send. Check your connection and try again.',
    // --- confirmación ---
    '¡Pedido recibido!': 'Order received!',
    'Ya lo tenemos en cocina. Guarda esta pantalla (captura) como justificante.': 'It’s already in the kitchen. Keep this screen (screenshot) as your receipt.',
    'Entrega estimada': 'Estimated delivery', 'Listo para recoger en': 'Ready for pick-up in',
    'Entrega en': 'Delivery to', 'Recogida en': 'Pick-up at', 'A nombre de': 'Under the name',
    'Pago: ': 'Payment: ', 'efectivo': 'cash', 'tarjeta': 'card', 'CP': 'Postcode',
    '¿Algún problema con tu pedido? Llámanos al': 'Any problem with your order? Call us at',
    'Hacer otro pedido': 'Place another order',
    // --- avisos ---
    'Ahora mismo estamos cerrados': 'We are currently closed',
    'Horario de hoy: ': 'Today’s hours: ',
    'Puedes ver la carta, pero no enviar pedidos.': 'You can browse the menu, but you can’t place orders.',
    'último pedido a las': 'last order at',
    'Pedidos en pausa unos minutos por mucha demanda. Vuelve en un rato o llámanos al': 'Orders are paused for a few minutes due to high demand. Please come back shortly or call us at',
    'Mucha demanda ahora. ': 'High demand right now. ', 'Entrega:': 'Delivery:', 'Recogida:': 'Pick-up:',
    // --- mensajes fijos del servidor ---
    'Demasiados pedidos seguidos. Inténtalo en unos minutos.': 'Too many orders in a row. Please try again in a few minutes.',
    'Ahora mismo no podemos recibir pedidos online. Llámanos al 919 47 62 01.': 'We can’t take online orders right now. Please call us on 919 47 62 01.',
    'Ahora mismo tenemos mucha demanda y hemos pausado los pedidos unos minutos. Vuelve a intentarlo en un rato o llámanos al 919 47 62 01.': 'We have very high demand and have paused orders for a few minutes. Please try again shortly or call us on 919 47 62 01.',
    'El pedido no contiene artículos.': 'The order has no items.',
    'Falta el nombre del cliente.': 'The customer name is missing.',
    'Falta el teléfono del cliente.': 'The customer phone is missing.',
    'Falta la dirección de entrega.': 'The delivery address is missing.',
    'No se pudo calcular el pedido.': 'The order could not be calculated.',
    'Algunos productos no se han reconocido. Por favor, revisa el pedido.': 'Some items were not recognised. Please check your order.'
  };

  var LANG = 'es';
  try {
    var saved = localStorage.getItem('lang');
    if (saved === 'es' || saved === 'en') LANG = saved;
    else {
      var nl = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
      LANG = /^en/i.test(nl) ? 'en' : 'es';
    }
  } catch (e) { /* sin almacenamiento: español */ }

  function T(s) { return (LANG === 'en' && EN[s]) || s; }
  // Traduce una lista separada por comas (modificaciones, extras...).
  function TL(arr) { return arr.map(T); }

  function applyStatic() {
    document.documentElement.lang = LANG;
    var els = document.querySelectorAll('[data-t]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.dataset.es === undefined) el.dataset.es = el.innerHTML.trim();
      el.innerHTML = T(el.dataset.es);
    }
    var btns = document.querySelectorAll('#langsw button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('on', btns[j].dataset.l === LANG);
  }

  function setLang(l) {
    if (l !== 'es' && l !== 'en') return;
    LANG = l; window.LANG = l;
    try { localStorage.setItem('lang', l); } catch (e) {}
    applyStatic();
    if (typeof window.onLangChange === 'function') window.onLangChange();
  }

  function buildSwitcher() {
    var h = document.querySelector('header');
    if (!h || document.getElementById('langsw')) return;
    var st = document.createElement('style');
    st.textContent = '#langsw{position:absolute;top:10px;right:12px;display:flex;border:1px solid var(--line,#444);border-radius:999px;overflow:hidden;background:rgba(0,0,0,.55);z-index:5}' +
      '#langsw button{all:unset;cursor:pointer;padding:6px 11px;font:600 12px/1 system-ui,sans-serif;color:var(--dim,#aaa);letter-spacing:.04em}' +
      '#langsw button.on{background:var(--text,#fff);color:#000}';
    document.head.appendChild(st);
    if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
    var d = document.createElement('div'); d.id = 'langsw';
    d.innerHTML = '<button data-l="es" aria-label="Español">ES</button><button data-l="en" aria-label="English">EN</button>';
    d.onclick = function (e) { var b = e.target.closest('button'); if (b) setLang(b.dataset.l); };
    h.appendChild(d);
  }

  window.LANG = LANG; window.T = T; window.TL = TL; window.setLang = setLang;
  window.I18N_EN = EN;
  window.addEventListener('DOMContentLoaded', function () { buildSwitcher(); applyStatic(); });
})();
