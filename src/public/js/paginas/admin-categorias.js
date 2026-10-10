import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { escapeHtml, limpiarAlerta, mostrarError, mostrarExito } from '../ui.js';

const alertas = document.getElementById('alertas');
const alertasAlta = document.getElementById('alertas-alta');
const tabla = document.getElementById('tabla-categorias');
const formCategoria = document.getElementById('form-categoria');

let categorias = [];
let enEdicion = null; // _id de la fila que se está editando (una sola a la vez)
let cargaEnCurso = 0; // descarta respuestas de una carga que ya fue reemplazada

function filaHtml(c) {
  const id = escapeHtml(c._id);
  if (c._id === enEdicion) {
    // Slug de solo lectura: no cambia al renombrar.
    return `<tr data-id="${id}">
      <td><input class="form-control form-control-sm" name="nombre" type="text" value="${escapeHtml(c.nombre)}" aria-label="Nombre" autocomplete="off"></td>
      <td><code>${escapeHtml(c.slug)}</code></td>
      <td><input class="form-control form-control-sm" name="descripcion" type="text" value="${escapeHtml(c.descripcion)}" aria-label="Descripción" autocomplete="off"></td>
      <td class="text-nowrap">
        <button type="button" class="btn btn-primary btn-sm" data-accion="guardar">Guardar</button>
        <button type="button" class="btn btn-outline-secondary btn-sm" data-accion="cancelar">Cancelar</button>
      </td>
    </tr>`;
  }
  return `<tr data-id="${id}">
    <td>${escapeHtml(c.nombre)}</td>
    <td><code>${escapeHtml(c.slug)}</code></td>
    <td>${escapeHtml(c.descripcion)}</td>
    <td class="text-nowrap">
      <button type="button" class="btn btn-outline-primary btn-sm" data-accion="editar">Editar</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-accion="eliminar">Eliminar</button>
    </td>
  </tr>`;
}

function pintar() {
  tabla.innerHTML = categorias.length === 0
    ? '<tr><td colspan="4" class="text-muted">No hay categorías.</td></tr>'
    : categorias.map(filaHtml).join('');
}

// Siempre vuelve a pedir la lista (no usa el catálogo cacheado de categorias.js):
// acá los datos cambian y tienen que salir del servidor. Deja la edición en curso
// descartada.
async function cargar() {
  const mia = ++cargaEnCurso;
  tabla.setAttribute('aria-busy', 'true');
  try {
    const { categorias: lista } = await api.get('/api/categorias');
    if (mia !== cargaEnCurso) return;
    categorias = lista;
    enEdicion = null;
    pintar();
  } catch (err) {
    if (mia !== cargaEnCurso) return;
    mostrarError(alertas, err);
  } finally {
    if (mia === cargaEnCurso) tabla.removeAttribute('aria-busy');
  }
}

function buscar(id) {
  return categorias.find((c) => c._id === id);
}

async function guardar(fila, boton) {
  limpiarAlerta(alertas);
  const cuerpo = {
    nombre: fila.querySelector('[name="nombre"]').value,
    descripcion: fila.querySelector('[name="descripcion"]').value,
  };
  boton.disabled = true;
  try {
    const { categoria } = await api.put(`/api/admin/categorias/${encodeURIComponent(fila.dataset.id)}`, cuerpo);
    categorias = categorias.map((c) => (c._id === categoria._id ? categoria : c));
    enEdicion = null;
    pintar();
    mostrarExito(alertas, `Categoría «${categoria.nombre}» actualizada.`);
  } catch (err) {
    // sin repintar: lo escrito en los campos se conserva para corregirlo
    boton.disabled = false;
    mostrarError(alertas, err);
  }
}

async function eliminar(fila, boton) {
  const categoria = buscar(fila.dataset.id);
  if (!window.confirm(`¿Eliminar la categoría «${categoria.nombre}»?`)) return;

  limpiarAlerta(alertas);
  boton.disabled = true;
  try {
    await api.delete(`/api/admin/categorias/${encodeURIComponent(categoria._id)}`);
    categorias = categorias.filter((c) => c._id !== categoria._id);
    pintar();
    mostrarExito(alertas, `Categoría «${categoria.nombre}» eliminada.`);
  } catch (err) {
    boton.disabled = false;
    // 409: el servidor informa cuántas recetas la usan en detalle.recetas
    const enUso = err.status === 409 ? err.detalle?.recetas : undefined;
    mostrarError(alertas, typeof enUso === 'number'
      ? { message: `No se puede eliminar «${categoria.nombre}»: la usan ${enUso} receta(s).` }
      : err);
  }
}

async function crear(e) {
  e.preventDefault();
  limpiarAlerta(alertasAlta);

  const cuerpo = {
    nombre: formCategoria.nombre.value,
    descripcion: formCategoria.descripcion.value, // string obligatorio, puede ser vacío
  };
  const boton = formCategoria.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const { categoria } = await api.post('/api/admin/categorias', cuerpo);
    formCategoria.reset();
    mostrarExito(alertasAlta, `Categoría «${categoria.nombre}» creada (slug: ${categoria.slug}).`);
    await cargar();
  } catch (err) {
    // los campos se conservan para corregir y reenviar
    mostrarError(alertasAlta, err);
  } finally {
    boton.disabled = false;
  }
}

async function iniciar() {
  const estado = await iniciarNav();
  // Sin sesión de admin no se pide nada a /api/admin/*: nav ya está redirigiendo
  // y el pedido solo mostraría un 403 antes de que termine la redirección.
  if (!(estado.autenticado && estado.usuario.rol === 'admin')) return;

  tabla.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    const fila = e.target.closest('tr[data-id]');
    if (!boton || !fila) return;

    switch (boton.dataset.accion) {
      case 'editar':
        enEdicion = fila.dataset.id;
        pintar();
        break;
      case 'cancelar':
        enEdicion = null;
        pintar();
        break;
      case 'guardar':
        guardar(fila, boton);
        break;
      case 'eliminar':
        eliminar(fila, boton);
        break;
      default:
    }
  });
  formCategoria.addEventListener('submit', crear);

  await cargar();
}

iniciar();
