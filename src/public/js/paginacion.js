// Controles Anterior/Siguiente para listados paginados por skip/limit
// (usuarios y moderaciones del admin). No pide datos: avisa a qué skip ir.
import { escapeHtml } from './ui.js';

// contenedor: elemento donde se pintan los controles.
// { skip, limit, total }: lo que se pidió y el total que informó el servidor.
// alIrA(nuevoSkip): lo llama el clic en Anterior/Siguiente; la página vuelve a pedir.
export function pintarPaginacion(contenedor, { skip, limit, total }, alIrA) {
  if (total === 0) {
    contenedor.innerHTML = '<p class="text-muted mb-0">Sin resultados.</p>';
    contenedor.onclick = null;
    return;
  }

  const desde = skip + 1;
  const hasta = Math.min(skip + limit, total);
  const hayAnterior = skip > 0;
  const haySiguiente = skip + limit < total;

  contenedor.innerHTML = `<div class="d-flex align-items-center gap-3">
    <button type="button" class="btn btn-outline-secondary btn-sm" data-skip="${Math.max(0, skip - limit)}"${hayAnterior ? '' : ' disabled'}>Anterior</button>
    <span class="text-muted small">${escapeHtml(`${desde}–${hasta} de ${total}`)}</span>
    <button type="button" class="btn btn-outline-secondary btn-sm" data-skip="${skip + limit}"${haySiguiente ? '' : ' disabled'}>Siguiente</button>
  </div>`;

  // Asignar onclick (no addEventListener): cada repintado reemplaza el manejador
  // en lugar de acumular uno nuevo.
  contenedor.onclick = (e) => {
    const boton = e.target.closest('button[data-skip]');
    if (boton && !boton.disabled) alIrA(Number(boton.dataset.skip));
  };
}
