import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { escapeHtml, mostrarError } from '../ui.js';
import { formatearFecha } from '../formato.js';
import { pintarPaginacion } from '../paginacion.js';

const LIMITE = 20;
const ETIQUETAS_TIPO = { receta: 'Receta', opinion: 'Opinión' };

const alertas = document.getElementById('alertas');
const tabla = document.getElementById('tabla-moderaciones');
const contPaginacion = document.getElementById('paginacion');

let cargaEnCurso = 0; // descarta respuestas de una carga que ya fue reemplazada

// La instantánea guarda lo que había al moderar (el contenido ya no existe).
// autorNombre, recetaTitulo y texto son opcionales: solo se muestra lo que haya.
function contenidoHtml(m) {
  const { autorNombre, recetaTitulo, texto } = m.instantanea ?? {};
  const partes = [];
  if (recetaTitulo !== undefined) {
    const rotulo = m.tipoContenido === 'opinion' ? 'En la receta' : 'Receta';
    partes.push(`<div>${rotulo}: <strong>${escapeHtml(recetaTitulo)}</strong></div>`);
  }
  if (autorNombre !== undefined) {
    partes.push(`<div class="small text-muted">Autor: ${escapeHtml(autorNombre)}</div>`);
  }
  if (texto !== undefined) {
    partes.push(`<div class="small fst-italic">«${escapeHtml(texto)}»</div>`);
  }
  return partes.join('') || '<span class="text-muted">—</span>';
}

function filaHtml(m) {
  return `<tr>
    <td class="text-nowrap">${escapeHtml(formatearFecha(m.fecha))}</td>
    <td>${escapeHtml(m.moderador?.nombre)}</td>
    <td>${escapeHtml(ETIQUETAS_TIPO[m.tipoContenido] ?? m.tipoContenido)}</td>
    <td>${contenidoHtml(m)}</td>
    <td>${escapeHtml(m.motivo)}</td>
  </tr>`;
}

async function cargar(skip) {
  const mia = ++cargaEnCurso;
  tabla.setAttribute('aria-busy', 'true');
  try {
    // la clave de la respuesta es `moderaciones`, no `items`
    const { moderaciones, total } = await api.get(`/api/admin/moderaciones?limit=${LIMITE}&skip=${skip}`);
    if (mia !== cargaEnCurso) return;

    tabla.innerHTML = moderaciones.length === 0
      ? '<tr><td colspan="5" class="text-muted">Todavía no hay moderaciones.</td></tr>'
      : moderaciones.map(filaHtml).join('');
    pintarPaginacion(contPaginacion, { skip, limit: LIMITE, total }, cargar);
  } catch (err) {
    if (mia !== cargaEnCurso) return;
    mostrarError(alertas, err);
  } finally {
    if (mia === cargaEnCurso) tabla.removeAttribute('aria-busy');
  }
}

async function iniciar() {
  const estado = await iniciarNav();
  // Sin sesión de admin no se pide nada a /api/admin/*: nav ya está redirigiendo
  // y el pedido solo mostraría un 403 antes de que termine la redirección.
  if (!(estado.autenticado && estado.usuario.rol === 'admin')) return;

  await cargar(0);
}

iniciar();
