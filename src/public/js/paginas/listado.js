import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { cargarCategorias, nombreCategoria } from '../categorias.js';
import { escapeHtml, limpiarAlerta, mostrarError } from '../ui.js';
import {
  etiquetaDificultad, etiquetaTipo, formatearFecha, formatearMinutos, textoPromedio,
} from '../formato.js';

const TAM_PAGINA = 12;
const ORDENES = ['puntaje', 'fecha', 'preparacion'];

const form = document.getElementById('form-filtros');
const filtroCategorias = document.getElementById('filtro-categorias');
const alertas = document.getElementById('alertas');
const alertasCategorias = document.getElementById('alertas-categorias'); // aparte: cargar() no lo limpia
const resultados = document.getElementById('resultados');
const paginacion = document.getElementById('paginacion');
const btnAnterior = document.getElementById('btn-anterior');
const btnSiguiente = document.getElementById('btn-siguiente');
const infoPagina = document.getElementById('info-pagina');

let ultimaCarga = 0; // descarta respuestas viejas si el usuario busca de nuevo rápido

// El estado de los filtros vive en la query string: se puede compartir y el botón Atrás funciona.
function leerFiltros() {
  const p = new URLSearchParams(location.search);
  const orden = p.get('orden');
  return {
    q: p.get('q') ?? '',
    ingredientes: p.get('ingredientes') ?? '',
    pais: p.get('pais') ?? '',
    orden: ORDENES.includes(orden) ? orden : 'puntaje',
    categorias: (p.get('categorias') ?? '').split(',').filter(Boolean),
    pagina: Math.max(parseInt(p.get('pagina'), 10) || 1, 1),
  };
}

function paramsDe(f) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.ingredientes.trim()) p.set('ingredientes', f.ingredientes.trim());
  if (f.pais.trim()) p.set('pais', f.pais.trim());
  if (f.categorias.length > 0) p.set('categorias', f.categorias.join(','));
  p.set('orden', f.orden);
  if (f.pagina > 1) p.set('pagina', String(f.pagina));
  return p;
}

function filtrosDesdeFormulario() {
  return {
    q: form.q.value,
    ingredientes: form.ingredientes.value,
    pais: form.pais.value,
    orden: form.orden.value,
    categorias: [...filtroCategorias.querySelectorAll('input:checked')].map((c) => c.value),
    pagina: 1,
  };
}

function aplicarAlFormulario(f) {
  form.q.value = f.q;
  form.ingredientes.value = f.ingredientes;
  form.pais.value = f.pais;
  form.orden.value = f.orden;
  filtroCategorias.querySelectorAll('input').forEach((c) => {
    c.checked = f.categorias.includes(c.value);
  });
}

function pintarFiltroCategorias(categorias) {
  filtroCategorias.innerHTML = categorias
    .map((c) => `<div class="form-check form-check-inline">
      <input class="form-check-input" type="checkbox" id="cat-${escapeHtml(c._id)}" value="${escapeHtml(c._id)}">
      <label class="form-check-label" for="cat-${escapeHtml(c._id)}">${escapeHtml(c.nombre)}</label>
    </div>`)
    .join('');
}

function tarjeta(r) {
  const cats = (r.categorias ?? []).map((id) => nombreCategoria(id));
  const detalles = [
    etiquetaDificultad(r.dificultad),
    r.tipo ? etiquetaTipo(r.tipo) : null,
    r.paisOrigen ?? null,
  ].filter(Boolean);
  const tiempos = `Prep. ${formatearMinutos(r.tiempoPreparacionMin)} · Cocción ${formatearMinutos(r.tiempoCoccionMin)}`;

  return `<div class="col">
    <div class="card h-100">
      <div class="card-body">
        <h2 class="h5 card-title">
          <a class="stretched-link text-decoration-none" href="/receta.html?id=${encodeURIComponent(r._id)}">${escapeHtml(r.titulo)}</a>
        </h2>
        <p class="card-subtitle text-muted small mb-2">por ${escapeHtml(r.autor?.nombre)} · ${escapeHtml(formatearFecha(r.fechaPublicacion))}</p>
        <p class="mb-1">${escapeHtml(textoPromedio(r.puntaje))}</p>
        <p class="mb-1 small">${escapeHtml(detalles.join(' · '))}</p>
        <p class="mb-2 small text-muted">${escapeHtml(tiempos)}</p>
        <div>${cats.map((n) => `<span class="badge text-bg-light border me-1">${escapeHtml(n)}</span>`).join('')}</div>
      </div>
    </div>
  </div>`;
}

function pintarResultados(recetas, pagina) {
  const hayMas = recetas.length > TAM_PAGINA; // se pidió una de más para saberlo sin total
  const visibles = recetas.slice(0, TAM_PAGINA);

  if (visibles.length === 0) {
    resultados.innerHTML = '<div class="col-12"><p class="text-muted">No hay recetas que coincidan con los filtros.</p></div>';
  } else {
    resultados.innerHTML = visibles.map(tarjeta).join('');
  }

  paginacion.hidden = pagina === 1 && !hayMas;
  btnAnterior.disabled = pagina === 1;
  btnSiguiente.disabled = !hayMas;
  infoPagina.textContent = `Página ${pagina}`;
}

async function cargar() {
  const f = leerFiltros();
  aplicarAlFormulario(f);
  const mia = ++ultimaCarga;
  limpiarAlerta(alertas);
  resultados.setAttribute('aria-busy', 'true');

  const consulta = paramsDe(f);
  consulta.delete('pagina');
  consulta.set('limit', String(TAM_PAGINA + 1));
  consulta.set('skip', String((f.pagina - 1) * TAM_PAGINA));

  try {
    const { recetas } = await api.get(`/api/consultas/buscar?${consulta}`);
    if (mia !== ultimaCarga) return;
    pintarResultados(recetas, f.pagina);
  } catch (err) {
    if (mia !== ultimaCarga) return;
    resultados.replaceChildren();
    paginacion.hidden = true;
    mostrarError(alertas, err);
  } finally {
    if (mia === ultimaCarga) resultados.removeAttribute('aria-busy');
  }
}

function irA(filtros) {
  history.pushState(null, '', `?${paramsDe(filtros)}`);
  cargar();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  irA(filtrosDesdeFormulario());
});

form.addEventListener('reset', (e) => {
  e.preventDefault();
  irA({ q: '', ingredientes: '', pais: '', orden: 'puntaje', categorias: [], pagina: 1 });
});

btnAnterior.addEventListener('click', () => {
  const f = leerFiltros();
  irA({ ...f, pagina: Math.max(f.pagina - 1, 1) });
  window.scrollTo(0, 0);
});

btnSiguiente.addEventListener('click', () => {
  const f = leerFiltros();
  irA({ ...f, pagina: f.pagina + 1 });
  window.scrollTo(0, 0);
});

window.addEventListener('popstate', cargar);

iniciarNav();
try {
  pintarFiltroCategorias(await cargarCategorias());
} catch (err) {
  mostrarError(alertasCategorias, err); // la búsqueda funciona igual, sin filtro ni nombres de categoría
}
cargar();
