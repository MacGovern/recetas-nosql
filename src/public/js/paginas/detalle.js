import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { obtener, suscribir } from '../sesion.js';
import { cargarCategorias, nombreCategoria } from '../categorias.js';
import {
  escapeHtml, leerParam, limpiarAlerta, mostrarError, mostrarExito,
} from '../ui.js';
import {
  estrellasTexto, etiquetaDificultad, etiquetaTipo, formatearFecha, formatearMinutos, textoPuntaje,
} from '../formato.js';

// Roles que pueden opinar (admin no hereda de usuario, así que no figura).
const ROLES_QUE_OPINAN = ['usuario', 'moderador'];

const id = leerParam('id');
const alertas = document.getElementById('alertas');
const contReceta = document.getElementById('receta-contenido');
const contOpiniones = document.getElementById('opiniones-seccion');

let receta = null; // documento de la consulta 2: receta + últimas 10 opiniones
let opinionEnEdicion = null; // _id de la opinión propia que se está editando

// Los ids llegan como string en el JSON y userId de la sesión también: se comparan como string.
function usuarioActual() {
  const estado = obtener();
  return estado.autenticado ? estado.usuario : null;
}

function esAutor() {
  const u = usuarioActual();
  return Boolean(u) && receta.autor._id === u.id;
}

// Solo http/https: evita que una url guardada como "javascript:..." termine en un href.
function urlSegura(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function filaCamposTipo(r) {
  const filas = [];
  if (r.temperaturaHornoC !== undefined) filas.push(['Temperatura del horno', `${r.temperaturaHornoC} °C`]);
  if (r.tipoVaso !== undefined) filas.push(['Tipo de vaso', r.tipoVaso]);
  if (r.tipoLenia !== undefined) filas.push(['Tipo de leña', r.tipoLenia]);
  if (r.puntoCoccion !== undefined) filas.push(['Punto de cocción', r.puntoCoccion]);
  return filas;
}

function ingredienteHtml(i) {
  const sust = i.sustituciones?.length
    ? ` <span class="text-muted small">(o: ${escapeHtml(i.sustituciones.join(', '))})</span>`
    : '';
  return `<li><strong>${escapeHtml(`${i.cantidad} ${i.unidad}`)}</strong> ${escapeHtml(i.nombre)}${sust}</li>`;
}

function pasoHtml(p) {
  let extra = '';
  if (p.tipo === 'temporizador') {
    extra = `<div class="small text-muted">⏱ ${escapeHtml(formatearMinutos(p.minutos))}</div>`;
  } else if (p.tipo === 'video') {
    const href = urlSegura(p.url);
    const enlace = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.url)}</a>`
      : escapeHtml(p.url);
    extra = `<div class="small">▶ ${enlace} (desde el segundo ${escapeHtml(p.segundos)})</div>`;
  }
  return `<li class="mb-2">${escapeHtml(p.contenido)}${extra}</li>`;
}

function pintarReceta() {
  const r = receta;
  const meta = [
    etiquetaDificultad(r.dificultad),
    r.tipo ? etiquetaTipo(r.tipo) : null,
    r.paisOrigen ?? null,
    `${r.porciones} ${r.porciones === 1 ? 'porción' : 'porciones'}`,
  ].filter(Boolean);
  const extras = filaCamposTipo(r)
    .map(([k, v]) => `<dt class="col-sm-4">${escapeHtml(k)}</dt><dd class="col-sm-8">${escapeHtml(v)}</dd>`)
    .join('');
  const acciones = esAutor()
    ? `<div class="mb-3">
         <a class="btn btn-outline-primary btn-sm" href="/receta-form.html?id=${encodeURIComponent(r._id)}">Editar</a>
         <button type="button" class="btn btn-outline-danger btn-sm" data-accion="eliminar-receta">Eliminar</button>
       </div>`
    : '';
  const pasos = [...r.pasos].sort((a, b) => a.orden - b.orden);

  contReceta.innerHTML = `
    <h1 class="h3">${escapeHtml(r.titulo)}</h1>
    <p class="text-muted mb-1">por ${escapeHtml(r.autor.nombre)} · ${escapeHtml(formatearFecha(r.fechaPublicacion))}</p>
    <p class="mb-2">${escapeHtml(textoPuntaje(r.puntaje))}</p>
    <div class="mb-2">${r.categorias.map((cid) => `<span class="badge text-bg-light border me-1">${escapeHtml(nombreCategoria(cid))}</span>`).join('')}</div>
    ${acciones}
    <p class="mb-1">${escapeHtml(meta.join(' · '))}</p>
    <p class="text-muted">Preparación ${escapeHtml(formatearMinutos(r.tiempoPreparacionMin))} · Cocción ${escapeHtml(formatearMinutos(r.tiempoCoccionMin))}</p>
    ${extras ? `<dl class="row">${extras}</dl>` : ''}
    <h2 class="h5 mt-4">Ingredientes</h2>
    <ul>${r.ingredientes.map(ingredienteHtml).join('')}</ul>
    <h2 class="h5 mt-4">Preparación</h2>
    <ol>${pasos.map(pasoHtml).join('')}</ol>`;
}

function opcionesEstrellas(seleccionada) {
  return [5, 4, 3, 2, 1]
    .map((n) => `<option value="${n}"${n === seleccionada ? ' selected' : ''}>${estrellasTexto(n)} (${n})</option>`)
    .join('');
}

// Sirve para opinión nueva (sin o) y para edición (con o).
function formOpinionHtml(o) {
  const sufijo = escapeHtml(o?._id ?? 'nueva');
  return `<form data-form="opinion" data-id="${escapeHtml(o?._id ?? '')}" novalidate>
    <div class="mb-2">
      <label class="form-label" for="estrellas-${sufijo}">Puntaje</label>
      <select class="form-select" id="estrellas-${sufijo}" name="estrellas">${opcionesEstrellas(o?.estrellas ?? 5)}</select>
    </div>
    <div class="mb-2">
      <label class="form-label" for="comentario-${sufijo}">Comentario</label>
      <textarea class="form-control" id="comentario-${sufijo}" name="comentario" rows="3" required>${escapeHtml(o?.comentario ?? '')}</textarea>
    </div>
    <button class="btn btn-primary btn-sm" type="submit">${o ? 'Guardar' : 'Publicar opinión'}</button>
    ${o ? '<button class="btn btn-outline-secondary btn-sm ms-2" type="button" data-accion="cancelar-edicion">Cancelar</button>' : ''}
  </form>`;
}

function opinionHtml(o) {
  const u = usuarioActual();
  const esMia = Boolean(u) && o.usuario._id === u.id;
  if (esMia && opinionEnEdicion === o._id) {
    return `<div class="card mb-2"><div class="card-body">${formOpinionHtml(o)}</div></div>`;
  }
  const acciones = esMia
    ? `<div class="mt-2">
         <button type="button" class="btn btn-link btn-sm p-0 me-3" data-accion="editar-opinion" data-id="${escapeHtml(o._id)}">Editar</button>
         <button type="button" class="btn btn-link btn-sm p-0 text-danger" data-accion="eliminar-opinion" data-id="${escapeHtml(o._id)}">Eliminar</button>
       </div>`
    : '';
  return `<div class="card mb-2"><div class="card-body">
    <div class="d-flex justify-content-between">
      <strong>${escapeHtml(o.usuario.nombre)}</strong>
      <span class="text-muted small">${escapeHtml(formatearFecha(o.fecha))}</span>
    </div>
    <div aria-label="${escapeHtml(o.estrellas)} de 5 estrellas">${estrellasTexto(o.estrellas)}</div>
    <p class="mb-0">${escapeHtml(o.comentario)}</p>
    ${acciones}
  </div></div>`;
}

function areaNuevaOpinionHtml() {
  const u = usuarioActual();
  if (!u) {
    const next = encodeURIComponent(location.pathname + location.search);
    return `<p class="text-muted">Para opinar, <a href="/login.html?next=${next}">iniciá sesión</a>.</p>`;
  }
  if (!ROLES_QUE_OPINAN.includes(u.rol)) return '';
  if (esAutor()) return '<p class="text-muted">No podés opinar tu propia receta.</p>';
  // Si la opinión propia quedó fuera de las últimas 10, este chequeo no la detecta;
  // el 409 del servidor cubre ese caso igual.
  if (receta.opiniones.some((o) => o.usuario._id === u.id)) return '';
  return `<div class="card mb-3"><div class="card-body">
    <h3 class="h6">Dejá tu opinión</h3>${formOpinionHtml(null)}</div></div>`;
}

function pintarOpiniones() {
  const total = receta.puntaje.cantidad;
  const nota = total > receta.opiniones.length
    ? `<p class="text-muted small">Se muestran las últimas ${receta.opiniones.length} de ${total} opiniones.</p>`
    : '';
  const lista = receta.opiniones.length > 0
    ? receta.opiniones.map(opinionHtml).join('')
    : '<p class="text-muted">Todavía no hay opiniones.</p>';

  contOpiniones.innerHTML = `<h2 class="h5">Opiniones</h2>${areaNuevaOpinionHtml()}${nota}${lista}`;
}

function pintarTodo() {
  pintarReceta();
  pintarOpiniones();
}

async function cargar() {
  const { receta: datos } = await api.get(`/api/consultas/recetas/${encodeURIComponent(id)}/con-opiniones`);
  receta = datos;
  document.title = `${receta.titulo} — Recetario`;
  pintarTodo();
}

// Tras cualquier cambio se vuelve a pedir la consulta 2: puntaje y lista salen del servidor.
async function accion(fn, mensajeExito) {
  limpiarAlerta(alertas);
  try {
    await fn();
    opinionEnEdicion = null;
    await cargar();
    if (mensajeExito) mostrarExito(alertas, mensajeExito);
  } catch (err) {
    mostrarError(alertas, err);
  }
}

contOpiniones.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-accion]');
  if (!boton) return;
  const { accion: que, id: opId } = boton.dataset;

  if (que === 'editar-opinion') {
    opinionEnEdicion = opId;
    pintarOpiniones();
  } else if (que === 'cancelar-edicion') {
    opinionEnEdicion = null;
    pintarOpiniones();
  } else if (que === 'eliminar-opinion') {
    if (!window.confirm('¿Eliminar tu opinión?')) return;
    accion(() => api.delete(`/api/opiniones/${encodeURIComponent(opId)}`), 'Opinión eliminada.');
  }
});

contOpiniones.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form="opinion"]');
  if (!form) return;
  e.preventDefault();

  const cuerpo = { comentario: form.comentario.value, estrellas: parseInt(form.estrellas.value, 10) };
  const opId = form.dataset.id;
  if (opId) {
    accion(() => api.put(`/api/opiniones/${encodeURIComponent(opId)}`, cuerpo), 'Opinión actualizada.');
  } else {
    accion(() => api.post('/api/opiniones', { recetaId: receta._id, ...cuerpo }), 'Opinión publicada.');
  }
});

contReceta.addEventListener('click', (e) => {
  if (e.target.closest('[data-accion="eliminar-receta"]') === null) return;
  if (!window.confirm('¿Eliminar esta receta y todas sus opiniones? No se puede deshacer.')) return;
  limpiarAlerta(alertas);
  api.delete(`/api/recetas/${encodeURIComponent(id)}`)
    .then(() => location.assign('/index.html'))
    .catch((err) => mostrarError(alertas, err));
});

async function iniciar() {
  if (!id) {
    mostrarError(alertas, { message: 'Falta el id de la receta.' });
    iniciarNav();
    return;
  }
  await iniciarNav(); // hace falta saber si hay sesión antes de decidir qué acciones mostrar
  try {
    await cargarCategorias();
  } catch {
    // sin catálogo las categorías se muestran como "(categoría desconocida)"
  }
  try {
    await cargar();
  } catch (err) {
    mostrarError(alertas, err);
    return;
  }
  suscribir(() => pintarTodo()); // login/logout desde la barra: se rehacen acciones y formularios
}

iniciar();
