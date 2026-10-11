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
import { nombrePais } from '../paises.js';

// Roles que pueden opinar (admin no hereda de usuario, así que no figura).
const ROLES_QUE_OPINAN = ['usuario', 'moderador'];
// Ídem para favoritos: admin no tiene favoritos (no hereda de usuario).
const ROLES_CON_FAVORITOS = ['usuario', 'moderador'];

const id = leerParam('id');
const alertas = document.getElementById('alertas');
const contReceta = document.getElementById('receta-contenido');
const contOpiniones = document.getElementById('opiniones-seccion');

// Modal de moderación: marcado estático de receta.html, fuera de los dos contenedores
// que se repintan con innerHTML.
const elModal = document.getElementById('modal-moderar');
const formModerar = document.getElementById('form-moderar');
const tituloModerar = document.getElementById('moderar-titulo');
const alertasModerar = document.getElementById('moderar-alertas');
const motivoModerar = document.getElementById('moderar-motivo');
const botonModerar = document.getElementById('moderar-confirmar');

let receta = null; // documento de la consulta 2: receta + últimas 10 opiniones
let opinionEnEdicion = null; // _id de la opinión propia que se está editando
let moderando = null; // { tipo: 'receta' | 'opinion', id } mientras el modal está abierto

// Favorito de esta receta para el usuario actual. Vive aparte de `receta`: tras cada
// cambio solo se repinta el botón, sin volver a pedir la consulta 2.
let esFavorita = false;
let favoritosListos = false; // false = todavía no se sabe (o falló): el botón no se muestra
let cambiandoFavorito = false; // hay un POST/DELETE en curso
let cargaFavoritos = 0; // descarta respuestas de un usuario que ya cerró sesión

// Los ids llegan como string en el JSON y userId de la sesión también: se comparan como string.
function usuarioActual() {
  const estado = obtener();
  return estado.autenticado ? estado.usuario : null;
}

function esAutor() {
  const u = usuarioActual();
  return Boolean(u) && receta.autor._id === u.id;
}

// Solo el moderador modera (admin no hereda de él). La UI replica el conflicto de
// interés para no ofrecer lo que el servidor rechaza con 403.
function puedeModerar() {
  const u = usuarioActual();
  return Boolean(u) && u.rol === 'moderador';
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

// Solo roles explícitos (usuario y moderador; admin no hereda). El autor también
// puede marcar su propia receta. Un visitante no lo ve.
function puedeFavoritear() {
  const u = usuarioActual();
  return Boolean(u) && ROLES_CON_FAVORITOS.includes(u.rol);
}

function favoritoHtml() {
  if (!favoritosListos || !puedeFavoritear()) return '';
  const clase = esFavorita ? 'btn-warning' : 'btn-outline-warning';
  const texto = esFavorita ? '★ En favoritos (quitar)' : '☆ Agregar a favoritos';
  return `<div class="mb-3">
    <button type="button" class="btn ${clase} btn-sm" data-accion="favorito" aria-pressed="${esFavorita}"${cambiandoFavorito ? ' disabled' : ''}>${texto}</button>
  </div>`;
}

function pintarBotonFavorito() {
  const contenedor = document.getElementById('favorito-contenedor');
  if (contenedor) contenedor.innerHTML = favoritoHtml();
}

// No bloquea el render de la receta: se llama después de pintarla y un fallo solo
// deja el botón oculto y muestra el error.
async function cargarFavoritos() {
  favoritosListos = false;
  const mia = ++cargaFavoritos;
  if (!receta || !puedeFavoritear()) {
    pintarBotonFavorito();
    return;
  }
  try {
    // redirigir401: false → una sesión vencida no echa al usuario de una página pública
    const { favoritos } = await api.get('/api/usuarios/favoritos', { redirigir401: false });
    if (mia !== cargaFavoritos) return;
    esFavorita = favoritos.includes(receta._id); // ambos son string
    favoritosListos = true;
  } catch (err) {
    if (mia !== cargaFavoritos) return;
    mostrarError(alertas, err);
  }
  pintarBotonFavorito();
}

async function alternarFavorito() {
  if (cambiandoFavorito) return;
  cambiandoFavorito = true;
  limpiarAlerta(alertas);
  pintarBotonFavorito(); // deshabilitado mientras dura el pedido
  const url = `/api/usuarios/favoritos/${encodeURIComponent(receta._id)}`;
  try {
    if (esFavorita) await api.delete(url);
    else await api.post(url);
    esFavorita = !esFavorita;
  } catch (err) {
    mostrarError(alertas, err);
  } finally {
    cambiandoFavorito = false;
    pintarBotonFavorito();
  }
}

function pintarReceta() {
  const r = receta;
  const meta = [
    etiquetaDificultad(r.dificultad),
    r.tipo ? etiquetaTipo(r.tipo) : null,
    r.paisOrigen ? nombrePais(r.paisOrigen) : null,
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
    : puedeModerar()
      ? `<div class="mb-3">
           <button type="button" class="btn btn-outline-danger btn-sm" data-accion="moderar-receta">Eliminar (moderación)</button>
         </div>`
      : '';
  const pasos = [...r.pasos].sort((a, b) => a.orden - b.orden);

  contReceta.innerHTML = `
    <h1 class="h3">${escapeHtml(r.titulo)}</h1>
    <p class="text-muted mb-1">por ${escapeHtml(r.autor.nombre)} · ${escapeHtml(formatearFecha(r.fechaPublicacion))}</p>
    <p class="mb-2">${escapeHtml(textoPuntaje(r.puntaje))}</p>
    <div class="mb-2">${r.categorias.map((cid) => `<span class="badge text-bg-light border me-1">${escapeHtml(nombreCategoria(cid))}</span>`).join('')}</div>
    ${acciones}
    <div id="favorito-contenedor">${favoritoHtml()}</div>
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
    : puedeModerar() && !esAutor()
      ? `<div class="mt-2">
           <button type="button" class="btn btn-link btn-sm p-0 text-danger" data-accion="moderar-opinion" data-id="${escapeHtml(o._id)}">Eliminar (moderación)</button>
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

function abrirModeracion(objetivo) {
  moderando = objetivo;
  tituloModerar.textContent = objetivo.tipo === 'receta' ? 'Eliminar receta' : 'Eliminar opinión';
  limpiarAlerta(alertasModerar);
  motivoModerar.value = '';
  botonModerar.disabled = false;
  bootstrap.Modal.getOrCreateInstance(elModal).show();
}

// No pasa por accion(): un error se muestra DENTRO del modal (abierto, con el motivo
// escrito intacto). Solo si el borrado salió bien se cierra y se repinta la página.
formModerar.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!moderando) return;
  const { tipo, id: contenidoId } = moderando;
  const ruta = tipo === 'receta' ? 'recetas' : 'opiniones';

  limpiarAlerta(alertasModerar);
  botonModerar.disabled = true;
  try {
    await api.delete(`/api/moderacion/${ruta}/${encodeURIComponent(contenidoId)}`, { motivo: motivoModerar.value });
  } catch (err) {
    mostrarError(alertasModerar, err);
    botonModerar.disabled = false;
    return;
  }

  bootstrap.Modal.getOrCreateInstance(elModal).hide();
  moderando = null;
  if (tipo === 'receta') {
    location.assign('/index.html');
    return;
  }
  limpiarAlerta(alertas);
  try {
    await cargar(); // vuelve a pedir la consulta 2: puntaje y lista salen del servidor
    mostrarExito(alertas, 'Opinión eliminada.');
  } catch (err) {
    mostrarError(alertas, err);
  }
});

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
  } else if (que === 'moderar-opinion') {
    abrirModeracion({ tipo: 'opinion', id: opId });
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
  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  if (boton.dataset.accion === 'favorito') {
    alternarFavorito();
  } else if (boton.dataset.accion === 'moderar-receta') {
    abrirModeracion({ tipo: 'receta', id });
  } else if (boton.dataset.accion === 'eliminar-receta') {
    if (!window.confirm('¿Eliminar esta receta y todas sus opiniones? No se puede deshacer.')) return;
    limpiarAlerta(alertas);
    api.delete(`/api/recetas/${encodeURIComponent(id)}`)
      .then(() => location.assign('/index.html'))
      .catch((err) => mostrarError(alertas, err));
  }
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
  // login/logout desde la barra: se rehacen acciones y formularios, y se recalcula el favorito
  suscribir(() => {
    favoritosListos = false;
    pintarTodo();
    cargarFavoritos();
  });
  cargarFavoritos(); // después de pintar la receta: no la retrasa ni la bloquea si falla
}

iniciar();
