// Único punto de contacto con la API. Ninguna página usa fetch directo.

export class ApiError extends Error {
  constructor(status, message, detalle) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detalle = detalle;
  }
}

const MENSAJES_POR_STATUS = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tenés que iniciar sesión.',
  403: 'No tenés permiso para hacer esto.',
  404: 'No se encontró lo que buscabas.',
  409: 'La operación entra en conflicto con datos existentes.',
  500: 'Error interno del servidor.',
};

let alSesionExpirada = () => {};

// sesion.js registra acá su callback (evita el import circular api <-> sesion).
export function registrarSesionExpirada(fn) {
  alSesionExpirada = fn;
}

function irALogin() {
  if (location.pathname === '/login.html') return;
  const next = encodeURIComponent(location.pathname + location.search);
  location.assign(`/login.html?next=${next}`);
}

async function pedir(metodo, url, cuerpo, { redirigir401 = true } = {}) {
  const init = { method: metodo, credentials: 'same-origin', headers: {} };
  if (cuerpo !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  try {
    respuesta = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // cuerpo vacío o no JSON: se resuelve abajo con el mensaje por status
  }

  if (respuesta.ok) return datos;

  if (respuesta.status === 401 && redirigir401) {
    alSesionExpirada();
    irALogin();
  }

  const mensaje = datos?.error || MENSAJES_POR_STATUS[respuesta.status] || `Error ${respuesta.status}.`;
  throw new ApiError(respuesta.status, mensaje, datos);
}

// opciones: { redirigir401: false } para llamadas donde un 401 es un resultado
// esperado (login con credenciales malas, /me, /logout).
export const api = {
  get: (url, opciones) => pedir('GET', url, undefined, opciones),
  post: (url, cuerpo = {}, opciones) => pedir('POST', url, cuerpo, opciones),
  put: (url, cuerpo = {}, opciones) => pedir('PUT', url, cuerpo, opciones),
  delete: (url, opciones) => pedir('DELETE', url, undefined, opciones),
};
