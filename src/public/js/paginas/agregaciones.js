import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { cargarCategorias } from '../categorias.js';
import { escapeHtml, limpiarAlerta, mostrarError } from '../ui.js';
import { tarjetaReceta } from '../tarjeta.js';

const formRanking = document.getElementById('form-ranking');
const alertasRanking = document.getElementById('alertas-ranking');
const resultadoRanking = document.getElementById('resultado-ranking');

const formPopulares = document.getElementById('form-populares');
const alertasPopulares = document.getElementById('alertas-populares');
const resultadoPopulares = document.getElementById('resultado-populares');

const formCocinables = document.getElementById('form-cocinables');
const filtroIngredientes = document.getElementById('filtro-ingredientes');
const alertasIngredientes = document.getElementById('alertas-ingredientes');
const alertasCocinables = document.getElementById('alertas-cocinables');
const resultadoCocinables = document.getElementById('resultado-cocinables');
const btnCocinables = document.getElementById('btn-cocinables');

// Lee un input numérico entero dentro de [min, max]. Lanza un Error con mensaje
// para el usuario (mostrarError solo necesita .message).
function leerEntero(input, etiqueta, { min, max = Infinity }) {
  const texto = input.value.trim();
  const n = Number(texto);
  if (texto === '' || !Number.isInteger(n) || n < min || n > max) {
    const rango = max === Infinity ? `un entero de ${min} o más` : `un entero entre ${min} y ${max}`;
    throw new Error(`${etiqueta} debe ser ${rango}.`);
  }
  return n;
}

// Mientras corre una consulta, el botón de envío queda deshabilitado.
async function conBoton(form, fn) {
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await fn();
  } finally {
    boton.disabled = false;
  }
}

// ---------- Consulta 4: ranking por categoría ----------

function categoriaRankingHtml(item) {
  const top3 = item.top3
    .map((r) => `<li><a href="/receta.html?id=${encodeURIComponent(r._id)}">${escapeHtml(r.titulo)}</a>
      <span class="text-muted small">(${escapeHtml(r.promedio.toFixed(1))} ★)</span></li>`)
    .join('');
  return `<div class="col">
    <div class="card h-100"><div class="card-body">
      <h3 class="h5 card-title">${escapeHtml(item.categoria.nombre)}</h3>
      <p class="mb-2 small text-muted">
        Promedio ${escapeHtml(item.promedio.toFixed(2))} ★ ·
        ${escapeHtml(item.cantidadOpiniones)} opiniones ·
        ${escapeHtml(item.cantidadRecetas)} ${item.cantidadRecetas === 1 ? 'receta' : 'recetas'}
      </p>
      <ol class="mb-0">${top3}</ol>
    </div></div>
  </div>`;
}

async function cargarRanking() {
  limpiarAlerta(alertasRanking);
  try {
    const minOpiniones = leerEntero(formRanking.minOpiniones, 'El mínimo de opiniones', { min: 1 });
    const { ranking } = await api.get(`/api/consultas/ranking-categorias?minOpiniones=${minOpiniones}`);
    resultadoRanking.innerHTML = ranking.length === 0
      ? `<div class="col-12"><p class="text-muted">Ninguna categoría tiene recetas con al menos ${minOpiniones} opiniones.</p></div>`
      : ranking.map(categoriaRankingHtml).join('');
  } catch (err) {
    resultadoRanking.replaceChildren();
    mostrarError(alertasRanking, err);
  }
}

// ---------- Consulta 5: ingredientes populares ----------

function tablaPopularesHtml(ingredientes) {
  const maximo = Math.max(...ingredientes.map((i) => i.recetas));
  const filas = ingredientes
    .map((i) => `<tr>
      <td class="text-nowrap">${escapeHtml(i.ingrediente)}</td>
      <td class="text-end">${escapeHtml(i.recetas)}</td>
      <td class="w-50"><div class="progress" aria-hidden="true">
        <div class="progress-bar" style="width: ${(i.recetas / maximo) * 100}%"></div>
      </div></td>
    </tr>`)
    .join('');
  return `<table class="table table-sm align-middle">
    <thead><tr><th>Ingrediente</th><th class="text-end">Recetas</th><th></th></tr></thead>
    <tbody>${filas}</tbody>
  </table>`;
}

async function cargarPopulares() {
  limpiarAlerta(alertasPopulares);
  try {
    const limit = leerEntero(formPopulares.limit, 'La cantidad a mostrar', { min: 1, max: 50 });
    const { ingredientes } = await api.get(`/api/consultas/ingredientes-populares?limit=${limit}`);
    resultadoPopulares.innerHTML = ingredientes.length === 0
      ? '<p class="text-muted">Todavía no hay recetas con ingredientes.</p>'
      : tablaPopularesHtml(ingredientes);
  } catch (err) {
    resultadoPopulares.replaceChildren();
    mostrarError(alertasPopulares, err);
  }
}

// ---------- Consulta 6: recetas cocinables ----------

// Pedido propio (limit=50), independiente de la sección de populares. El servidor
// las devuelve por popularidad; acá se ordenan alfabéticamente para poder recorrerlas.
async function cargarIngredientes() {
  limpiarAlerta(alertasIngredientes);
  try {
    const { ingredientes } = await api.get('/api/consultas/ingredientes-populares?limit=50');
    const nombres = ingredientes.map((i) => i.ingrediente).sort((a, b) => a.localeCompare(b, 'es'));
    if (nombres.length === 0) {
      filtroIngredientes.innerHTML = '<p class="text-muted mb-0">Todavía no hay ingredientes cargados.</p>';
      return;
    }
    filtroIngredientes.innerHTML = nombres
      .map((n, idx) => `<div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="ing-${idx}" value="${escapeHtml(n)}">
        <label class="form-check-label" for="ing-${idx}">${escapeHtml(n)}</label>
      </div>`)
      .join('');
    btnCocinables.disabled = false;
  } catch (err) {
    mostrarError(alertasIngredientes, err); // el botón queda deshabilitado: sin casillas no hay consulta
  }
}

function pieCocinable(r) {
  if (r.cantidadFaltantes === 0) {
    return '<p class="mt-2 mb-0 small text-success">Tenés todos los ingredientes.</p>';
  }
  return `<p class="mt-2 mb-0 small">Te ${r.cantidadFaltantes === 1 ? 'falta' : 'faltan'}:
    ${escapeHtml([...r.faltantes].sort((a, b) => a.localeCompare(b, 'es')).join(', '))}</p>`;
}

formCocinables.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarAlerta(alertasCocinables);
  try {
    const tengo = [...filtroIngredientes.querySelectorAll('input:checked')].map((c) => c.value);
    if (tengo.length === 0) throw new Error('Marcá al menos un ingrediente.');
    const maxFaltantes = leerEntero(formCocinables.maxFaltantes, 'La cantidad de faltantes', { min: 0 });

    const consulta = new URLSearchParams({ tengo: tengo.join(','), maxFaltantes: String(maxFaltantes) });
    btnCocinables.disabled = true;
    try {
      const { recetas } = await api.get(`/api/consultas/cocinables?${consulta}`);
      try {
        await cargarCategorias(); // para los nombres de categoría de las tarjetas
      } catch {
        // sin catálogo se muestra "(categoría desconocida)"
      }
      resultadoCocinables.innerHTML = recetas.length === 0
        ? '<div class="col-12"><p class="text-muted">No hay recetas que puedas cocinar con esos ingredientes.</p></div>'
        : recetas.map((r) => tarjetaReceta(r, { pie: pieCocinable(r) })).join('');
    } finally {
      btnCocinables.disabled = false;
    }
  } catch (err) {
    resultadoCocinables.replaceChildren();
    mostrarError(alertasCocinables, err);
  }
});

formRanking.addEventListener('submit', (e) => {
  e.preventDefault();
  conBoton(formRanking, cargarRanking);
});

formPopulares.addEventListener('submit', (e) => {
  e.preventDefault();
  conBoton(formPopulares, cargarPopulares);
});

iniciarNav();
// Cada sección carga y falla por su cuenta: una caída no tapa a las otras.
await Promise.all([cargarRanking(), cargarPopulares(), cargarIngredientes()]);
