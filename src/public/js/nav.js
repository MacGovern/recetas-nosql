import { api } from './api.js';
import { iniciar, obtener, suscribir, limpiar, rolActual } from './sesion.js';
import { escapeHtml } from './ui.js';

const TODOS = ['visitante', 'usuario', 'moderador', 'admin'];

// Cada ítem enumera sus roles de forma explícita: admin NO hereda de usuario,
// así que nunca se usa "todo lo que no sea visitante". Las partes B y C agregan
// una línea por pantalla.
const ITEMS = [
  { texto: 'Inicio', href: '/index.html', roles: TODOS },
  { texto: 'Ingresar', href: '/login.html', roles: ['visitante'] },
  { texto: 'Registrarse', href: '/registro.html', roles: ['visitante'] },
];

// Páginas que exigen sesión: al cerrarla se redirige a login. B y C las agregan.
const PAGINAS_PROTEGIDAS = [];

// Roles con botón de cuenta/Salir, enumerados explícitamente.
const ROLES_CON_SESION = ['usuario', 'moderador', 'admin'];

function html(estado) {
  const marca = '<a class="navbar-brand" href="/index.html">Recetario</a>';
  if (!estado.listo) return `<div class="container">${marca}</div>`;

  const rol = rolActual();
  const enlaces = ITEMS.filter((i) => i.roles.includes(rol))
    .map((i) => {
      const activo = location.pathname === i.href ? ' active' : '';
      return `<li class="nav-item"><a class="nav-link${activo}" href="${i.href}">${escapeHtml(i.texto)}</a></li>`;
    })
    .join('');

  const cuenta = ROLES_CON_SESION.includes(rol)
    ? `<span class="navbar-text me-3">${escapeHtml(estado.usuario.nombre)}
         <span class="badge text-bg-secondary">${escapeHtml(rol)}</span></span>
       <button type="button" class="btn btn-outline-light btn-sm" id="nav-salir">Salir</button>`
    : '';

  return `<div class="container">
    ${marca}
    <ul class="navbar-nav me-auto">${enlaces}</ul>
    <div class="d-flex align-items-center">${cuenta}</div>
  </div>`;
}

async function salir() {
  try {
    await api.post('/api/auth/logout', {}, { redirigir401: false });
  } catch {
    // si el servidor ya no reconoce la sesión, igual queda cerrada del lado cliente
  }
  limpiar();
  if (PAGINAS_PROTEGIDAS.includes(location.pathname)) {
    location.assign(`/login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
  }
}

function pintar(raiz, estado) {
  raiz.innerHTML = html(estado);
  raiz.querySelector('#nav-salir')?.addEventListener('click', salir);
}

// Devuelve la promesa del estado inicial para que la página espere a saber si hay sesión.
export function iniciarNav() {
  const raiz = document.getElementById('nav-root');
  raiz.className = 'navbar navbar-expand navbar-dark bg-dark mb-4';
  pintar(raiz, obtener());
  suscribir((estado) => pintar(raiz, estado));
  return iniciar();
}
