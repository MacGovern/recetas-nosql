import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { escapeHtml, limpiarAlerta, mostrarError, mostrarExito } from '../ui.js';
import { formatearFecha } from '../formato.js';
import { pintarPaginacion } from '../paginacion.js';

const LIMITE = 20;
// Solo estos dos se asignan desde acá; las cuentas admin no se tocan (el servidor
// también responde 403), así que su fila no lleva selector.
const ROLES_ASIGNABLES = ['usuario', 'moderador'];

const alertas = document.getElementById('alertas');
const alertasAdmin = document.getElementById('alertas-admin');
const tabla = document.getElementById('tabla-usuarios');
const contPaginacion = document.getElementById('paginacion');
const formAdmin = document.getElementById('form-admin');

let skipActual = 0;
let cargaEnCurso = 0; // descarta respuestas de una carga que ya fue reemplazada

function celdaRol(u) {
  if (!ROLES_ASIGNABLES.includes(u.rol)) {
    return `<span class="badge text-bg-dark">${escapeHtml(u.rol)}</span>`;
  }
  const opciones = ROLES_ASIGNABLES
    .map((r) => `<option value="${r}"${r === u.rol ? ' selected' : ''}>${r}</option>`)
    .join('');
  return `<select class="form-select form-select-sm w-auto" data-accion="cambiar-rol"
            data-id="${escapeHtml(u._id)}" data-rol="${escapeHtml(u.rol)}"
            aria-label="Rol de ${escapeHtml(u.nombre)}">${opciones}</select>`;
}

function filaHtml(u) {
  return `<tr>
    <td>${escapeHtml(u.nombre)}</td>
    <td>${escapeHtml(u.email)}</td>
    <td>${celdaRol(u)}</td>
    <td>${escapeHtml(formatearFecha(u.fechaRegistro))}</td>
  </tr>`;
}

async function cargar(skip) {
  const mia = ++cargaEnCurso;
  tabla.setAttribute('aria-busy', 'true');
  try {
    const { usuarios, total } = await api.get(`/api/admin/usuarios?limit=${LIMITE}&skip=${skip}`);
    if (mia !== cargaEnCurso) return;

    // La página pedida quedó más allá del final: se vuelve a la última que existe.
    if (usuarios.length === 0 && total > 0 && skip > 0) {
      await cargar((Math.ceil(total / LIMITE) - 1) * LIMITE);
      return;
    }

    skipActual = skip;
    tabla.innerHTML = usuarios.length === 0
      ? '<tr><td colspan="4" class="text-muted">No hay usuarios.</td></tr>'
      : usuarios.map(filaHtml).join('');
    pintarPaginacion(contPaginacion, { skip, limit: LIMITE, total }, cargar);
  } catch (err) {
    if (mia !== cargaEnCurso) return;
    mostrarError(alertas, err);
  } finally {
    if (mia === cargaEnCurso) tabla.removeAttribute('aria-busy');
  }
}

async function cambiarRol(select) {
  const rolAnterior = select.dataset.rol;
  const rolNuevo = select.value;
  if (rolNuevo === rolAnterior) return;

  limpiarAlerta(alertas);
  select.disabled = true;
  try {
    const { usuario } = await api.put(`/api/admin/usuarios/${encodeURIComponent(select.dataset.id)}/rol`, { rol: rolNuevo });
    select.dataset.rol = usuario.rol;
    select.value = usuario.rol;
    mostrarExito(alertas, `El rol de ${usuario.nombre} ahora es ${usuario.rol}.`);
  } catch (err) {
    select.value = rolAnterior; // el servidor no cambió nada: el selector vuelve a lo real
    mostrarError(alertas, err);
  } finally {
    select.disabled = false;
  }
}

async function crearAdministrador(e) {
  e.preventDefault();
  limpiarAlerta(alertasAdmin);

  const cuerpo = {
    nombre: formAdmin.nombre.value,
    email: formAdmin.email.value,
    password: formAdmin.password.value,
  };
  const boton = formAdmin.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const { usuario } = await api.post('/api/admin/administradores', cuerpo);
    formAdmin.reset();
    mostrarExito(alertasAdmin, `Administrador ${usuario.nombre} creado.`);
    await cargar(skipActual);
  } catch (err) {
    // los campos se conservan para corregir y reenviar
    mostrarError(alertasAdmin, err);
  } finally {
    boton.disabled = false;
  }
}

async function iniciar() {
  const estado = await iniciarNav();
  // Sin sesión de admin no se pide nada a /api/admin/*: nav ya está redirigiendo
  // y el pedido solo mostraría un 403 antes de que termine la redirección.
  if (!(estado.autenticado && estado.usuario.rol === 'admin')) return;

  tabla.addEventListener('change', (e) => {
    const select = e.target.closest('select[data-accion="cambiar-rol"]');
    if (select) cambiarRol(select);
  });
  formAdmin.addEventListener('submit', crearAdministrador);

  await cargar(0);
}

iniciar();
