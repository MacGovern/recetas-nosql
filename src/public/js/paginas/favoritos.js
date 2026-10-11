import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { cargarCategorias } from '../categorias.js';
import { escapeHtml, limpiarAlerta, mostrarError } from '../ui.js';
import { tarjetaReceta } from '../tarjeta.js';

const alertas = document.getElementById('alertas');
const resultados = document.getElementById('resultados');

const VACIO = '<div class="col-12"><p class="text-muted">Todavía no tenés recetas favoritas. Podés marcarlas desde el detalle de cada receta.</p></div>';

// position-relative z-2: el ::after del stretched-link de la tarjeta (z-index 1)
// tapa cualquier control que no tenga un z-index mayor.
function botonQuitar(r) {
  return `<div class="mt-3">
    <button type="button" class="btn btn-outline-danger btn-sm position-relative z-2"
            data-accion="quitar" data-id="${escapeHtml(r._id)}">Quitar de favoritos</button>
  </div>`;
}

function pintar(recetas) {
  resultados.innerHTML = recetas.length === 0
    ? VACIO
    : recetas.map((r) => tarjetaReceta(r, { pie: botonQuitar(r) })).join('');
}

async function quitar(boton) {
  limpiarAlerta(alertas);
  boton.disabled = true;
  try {
    await api.delete(`/api/usuarios/favoritos/${encodeURIComponent(boton.dataset.id)}`);
    boton.closest('.col').remove();
    if (resultados.children.length === 0) resultados.innerHTML = VACIO;
  } catch (err) {
    boton.disabled = false;
    mostrarError(alertas, err);
  }
}

resultados.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-accion="quitar"]');
  if (boton) quitar(boton);
});

async function iniciar() {
  const estado = await iniciarNav(); // sin sesión, redirige a login (ver PAGINAS_PROTEGIDAS)
  // admin no tiene favoritos: no se piden categorías ni favoritos mientras nav redirige.
  if (!(estado.autenticado && ['usuario', 'moderador'].includes(estado.usuario.rol))) return;

  try {
    await cargarCategorias();
  } catch {
    // sin catálogo las categorías se muestran como "(categoría desconocida)"
  }

  resultados.setAttribute('aria-busy', 'true');
  try {
    const { favoritos } = await api.get('/api/consultas/favoritos');
    pintar(favoritos);
  } catch (err) {
    mostrarError(alertas, err);
  } finally {
    resultados.removeAttribute('aria-busy');
  }
}

iniciar();
