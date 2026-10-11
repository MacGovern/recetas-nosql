// Tarjeta de receta para grillas (listado, favoritos, cocinables).
// Recibe un documento con la forma de PROYECCION_LISTADO.
import { nombreCategoria } from './categorias.js';
import { escapeHtml } from './ui.js';
import {
  etiquetaDificultad, etiquetaTipo, formatearFecha, formatearMinutos, textoPromedio,
} from './formato.js';
import { nombrePais } from './paises.js';

// pie: HTML ya escapado por quien llama; se agrega al final del cuerpo de la tarjeta.
// Si trae controles clicables, deben llevar `position-relative z-2`: el
// stretched-link del título cubre toda la tarjeta con un ::after de z-index 1.
export function tarjetaReceta(r, { pie = '' } = {}) {
  const cats = (r.categorias ?? []).map((id) => nombreCategoria(id));
  const detalles = [
    etiquetaDificultad(r.dificultad),
    r.tipo ? etiquetaTipo(r.tipo) : null,
    r.paisOrigen ? nombrePais(r.paisOrigen) : null,
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
        ${pie}
      </div>
    </div>
  </div>`;
}
