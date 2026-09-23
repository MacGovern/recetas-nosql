const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function pintarAlerta(contenedor, clase, mensaje) {
  contenedor.replaceChildren();
  const div = document.createElement('div');
  div.className = `alert ${clase}`;
  div.setAttribute('role', 'alert');
  div.textContent = mensaje;
  contenedor.appendChild(div);
}

export function mostrarError(contenedor, err) {
  pintarAlerta(contenedor, 'alert-danger', err?.message || 'Ocurrió un error inesperado.');
}

export function mostrarExito(contenedor, mensaje) {
  pintarAlerta(contenedor, 'alert-success', mensaje);
}

export function limpiarAlerta(contenedor) {
  contenedor.replaceChildren();
}

// URLSearchParams.get() ya devuelve el valor decodificado.
export function leerParam(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

// Recibe el valor ya decodificado. Solo rutas relativas del mismo origen:
// evita open redirect vía ?next=.
export function rutaSegura(ruta, porDefecto = '/index.html') {
  if (typeof ruta !== 'string') return porDefecto;
  if (!ruta.startsWith('/') || ruta.startsWith('//') || ruta.startsWith('/\\')) return porDefecto;
  return ruta;
}
