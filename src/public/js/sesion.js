// Estado de sesión del cliente. La fuente de verdad es el servidor (GET /api/auth/me).
import { api, registrarSesionExpirada } from './api.js';

let estado = { listo: false, autenticado: false, usuario: null };
const oyentes = new Set();

function cambiar(nuevo) {
  estado = { listo: true, ...nuevo };
  oyentes.forEach((fn) => fn(estado));
}

export function obtener() {
  return estado;
}

// 'visitante' | 'usuario' | 'moderador' | 'admin'
export function rolActual() {
  return estado.autenticado ? estado.usuario.rol : 'visitante';
}

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export function establecer(usuario) {
  cambiar({ autenticado: true, usuario });
}

export function limpiar() {
  cambiar({ autenticado: false, usuario: null });
}

export async function iniciar() {
  try {
    const r = await api.get('/api/auth/me', { redirigir401: false });
    if (r.authenticated) establecer(r.usuario);
    else limpiar();
  } catch {
    limpiar();
  }
  return estado;
}

registrarSesionExpirada(limpiar);
