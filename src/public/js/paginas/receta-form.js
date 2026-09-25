// Alta y edición de recetas (una sola pantalla: con ?id= es edición).
//
// El PUT de recetas es REEMPLAZO COMPLETO: los campos que no se envían se $unset.
// Por eso armarBody() lee siempre TODOS los controles del formulario (que en edición
// se precargan con la receta completa) y nunca envía un diff ni solo lo tocado.
import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { cargarCategorias } from '../categorias.js';
import { leerParam, limpiarAlerta, mostrarError } from '../ui.js';

// Espejo de CAMPOS_POR_TIPO en recetas.controller.js.
const CAMPOS_POR_TIPO = {
  horno: ['temperaturaHornoC'],
  trago: ['tipoVaso'],
  asado: ['tipoLenia', 'puntoCoccion'],
  olla: [],
};
const CAMPOS_VARIABLES = ['temperaturaHornoC', 'tipoVaso', 'tipoLenia', 'puntoCoccion'];
const CAMPOS_ENTEROS_DE_TIPO = ['temperaturaHornoC']; // el schema los exige int; el resto es texto

const idEdicion = leerParam('id');

const form = document.getElementById('form-receta');
const alertas = document.getElementById('alertas');
const tituloPagina = document.getElementById('titulo-pagina');
const contCategorias = document.getElementById('campo-categorias');
const listaIngredientes = document.getElementById('lista-ingredientes');
const listaPasos = document.getElementById('lista-pasos');
const btnGuardar = form.querySelector('button[type="submit"]');

function campo(nombre) {
  return form.elements[nombre];
}

// ---------- Parseo de números (los inputs entregan texto) ----------

function entero(texto) {
  const t = String(texto).trim();
  return /^-?\d+$/.test(t) ? parseInt(t, 10) : NaN;
}

// Acepta coma decimal ("1,5"), habitual en es-UY.
function decimal(texto) {
  const t = String(texto).trim().replace(',', '.');
  return t !== '' && Number.isFinite(Number(t)) ? Number(t) : NaN;
}

function urlHttp(texto) {
  try {
    const u = new URL(texto);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------- Tipo de receta: campos derivados ----------

// Solo se muestra el bloque del tipo elegido. Los inputs de los otros bloques conservan
// su valor (si el usuario vuelve atrás no pierde lo escrito), pero armarBody() nunca los
// lee: viajan solo los campos del tipo final, y el servidor $unsetea el resto.
function mostrarBloqueTipo() {
  const tipo = campo('tipo').value;
  form.querySelectorAll('[data-tipo-bloque]').forEach((bloque) => {
    bloque.hidden = bloque.dataset.tipoBloque !== tipo;
  });
}

campo('tipo').addEventListener('change', mostrarBloqueTipo);

// ---------- Categorías ----------

function pintarCategorias(categorias) {
  contCategorias.replaceChildren();
  categorias.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'form-check form-check-inline';

    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'checkbox';
    input.id = `cat-${c._id}`;
    input.value = c._id;

    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = input.id;
    label.textContent = c.nombre;

    div.append(input, label);
    contCategorias.appendChild(div);
  });
}

// ---------- Ingredientes ----------

function agregarIngrediente(i = {}) {
  const fila = document.createElement('div');
  fila.className = 'row g-2 align-items-end mb-2 fila-ingrediente';
  fila.innerHTML = `
    <div class="col-12 col-md-3">
      <label class="form-label small mb-1">Ingrediente</label>
      <input class="form-control ing-nombre" type="text">
    </div>
    <div class="col-6 col-md-2">
      <label class="form-label small mb-1">Cantidad</label>
      <input class="form-control ing-cantidad" type="text" inputmode="decimal">
    </div>
    <div class="col-6 col-md-2">
      <label class="form-label small mb-1">Unidad</label>
      <input class="form-control ing-unidad" type="text" placeholder="g, ml, cda…">
    </div>
    <div class="col-9 col-md-4">
      <label class="form-label small mb-1">Sustituciones (separadas por coma)</label>
      <input class="form-control ing-sustituciones" type="text">
    </div>
    <div class="col-3 col-md-1">
      <button type="button" class="btn btn-outline-danger w-100 btn-quitar" aria-label="Quitar ingrediente">✕</button>
    </div>`;
  // Los valores se asignan por propiedad (no por HTML) para no tener que escapar nada.
  fila.querySelector('.ing-nombre').value = i.nombre ?? '';
  fila.querySelector('.ing-cantidad').value = i.cantidad ?? '';
  fila.querySelector('.ing-unidad').value = i.unidad ?? '';
  fila.querySelector('.ing-sustituciones').value = (i.sustituciones ?? []).join(', ');
  listaIngredientes.appendChild(fila);
}

// ---------- Pasos ----------

function actualizarFilaPaso(fila) {
  const tipo = fila.querySelector('.paso-tipo').value;
  fila.querySelectorAll('[data-paso-tipo]').forEach((bloque) => {
    bloque.hidden = bloque.dataset.pasoTipo !== tipo;
  });
}

function renumerarPasos() {
  listaPasos.querySelectorAll('.fila-paso').forEach((fila, idx) => {
    fila.querySelector('.numero-paso').textContent = `Paso ${idx + 1}`;
  });
}

function agregarPaso(p = {}) {
  const fila = document.createElement('div');
  fila.className = 'row g-2 mb-3 fila-paso border-bottom pb-3';
  fila.innerHTML = `
    <div class="col-12 fw-semibold small numero-paso"></div>
    <div class="col-12 col-md-3">
      <label class="form-label small mb-1">Tipo de paso</label>
      <select class="form-select paso-tipo">
        <option value="texto">Texto</option>
        <option value="temporizador">Temporizador</option>
        <option value="video">Video</option>
      </select>
    </div>
    <div class="col-10 col-md-8">
      <label class="form-label small mb-1">Contenido</label>
      <textarea class="form-control paso-contenido" rows="2"></textarea>
    </div>
    <div class="col-2 col-md-1 d-flex align-items-end">
      <button type="button" class="btn btn-outline-danger w-100 btn-quitar" aria-label="Quitar paso">✕</button>
    </div>
    <div class="col-6 col-md-3" data-paso-tipo="temporizador" hidden>
      <label class="form-label small mb-1">Minutos</label>
      <input class="form-control paso-minutos" type="text" inputmode="numeric">
    </div>
    <div class="col-12 col-md-6" data-paso-tipo="video" hidden>
      <label class="form-label small mb-1">URL del video</label>
      <input class="form-control paso-url" type="text" placeholder="https://…">
    </div>
    <div class="col-6 col-md-3" data-paso-tipo="video" hidden>
      <label class="form-label small mb-1">Desde el segundo</label>
      <input class="form-control paso-segundos" type="text" inputmode="numeric">
    </div>`;
  fila.querySelector('.paso-tipo').value = p.tipo ?? 'texto';
  fila.querySelector('.paso-contenido').value = p.contenido ?? '';
  fila.querySelector('.paso-minutos').value = p.minutos ?? '';
  fila.querySelector('.paso-url').value = p.url ?? '';
  fila.querySelector('.paso-segundos').value = p.segundos ?? '';
  listaPasos.appendChild(fila);
  actualizarFilaPaso(fila);
  renumerarPasos();
}

document.getElementById('btn-agregar-ingrediente').addEventListener('click', () => agregarIngrediente());
document.getElementById('btn-agregar-paso').addEventListener('click', () => agregarPaso());

listaIngredientes.addEventListener('click', (e) => {
  if (e.target.closest('.btn-quitar')) e.target.closest('.fila-ingrediente').remove();
});

listaPasos.addEventListener('click', (e) => {
  if (e.target.closest('.btn-quitar')) {
    e.target.closest('.fila-paso').remove();
    renumerarPasos();
  }
});

listaPasos.addEventListener('change', (e) => {
  if (e.target.classList.contains('paso-tipo')) actualizarFilaPaso(e.target.closest('.fila-paso'));
});

// ---------- Precarga (edición) ----------

// Rellena TODOS los controles con la receta existente: es lo que hace que un guardado
// sin tocar nada reenvíe la receta completa.
function poblar(r) {
  campo('titulo').value = r.titulo;
  campo('porciones').value = r.porciones;
  campo('tiempoPreparacionMin').value = r.tiempoPreparacionMin;
  campo('tiempoCoccionMin').value = r.tiempoCoccionMin;
  campo('dificultad').value = r.dificultad;
  campo('paisOrigen').value = r.paisOrigen ?? '';
  campo('tipo').value = r.tipo ?? '';
  CAMPOS_VARIABLES.forEach((nombre) => {
    if (r[nombre] !== undefined) campo(nombre).value = r[nombre];
  });

  const elegidas = new Set(r.categorias);
  contCategorias.querySelectorAll('input').forEach((c) => {
    c.checked = elegidas.has(c.value);
  });

  r.ingredientes.forEach(agregarIngrediente);
  [...r.pasos].sort((a, b) => a.orden - b.orden).forEach(agregarPaso);
  mostrarBloqueTipo();
}

// ---------- Armado del body ----------

// Devuelve { error } o { body }. Valida lo mismo que el servidor para dar mensajes
// claros; el servidor sigue siendo la barrera real.
function armarBody() {
  const titulo = campo('titulo').value.trim();
  if (!titulo) return { error: 'El título es obligatorio.' };

  const porciones = entero(campo('porciones').value);
  if (!(porciones >= 1)) return { error: 'Las porciones deben ser un entero mayor o igual a 1.' };

  const tiempoPreparacionMin = entero(campo('tiempoPreparacionMin').value);
  if (!(tiempoPreparacionMin >= 0)) return { error: 'El tiempo de preparación debe ser un entero mayor o igual a 0.' };

  const tiempoCoccionMin = entero(campo('tiempoCoccionMin').value);
  if (!(tiempoCoccionMin >= 0)) return { error: 'El tiempo de cocción debe ser un entero mayor o igual a 0.' };

  const categorias = [...contCategorias.querySelectorAll('input:checked')].map((c) => c.value);
  if (categorias.length === 0) return { error: 'Elegí al menos una categoría.' };

  const ingredientes = [];
  const filasIng = [...listaIngredientes.querySelectorAll('.fila-ingrediente')];
  for (let i = 0; i < filasIng.length; i += 1) {
    const fila = filasIng[i];
    const n = i + 1;
    // Minúsculas al guardar: la consulta 5 agrupa por nombre exacto ("Sal" ≠ "sal").
    // El servidor lo normaliza también; acá evita que el usuario vea otra cosa al recargar.
    const nombre = fila.querySelector('.ing-nombre').value.trim().toLowerCase();
    const cantidad = decimal(fila.querySelector('.ing-cantidad').value);
    const unidad = fila.querySelector('.ing-unidad').value.trim();
    if (!nombre) return { error: `Ingrediente ${n}: falta el nombre.` };
    if (!(cantidad >= 0)) return { error: `Ingrediente ${n}: la cantidad debe ser un número mayor o igual a 0.` };
    if (!unidad) return { error: `Ingrediente ${n}: falta la unidad.` };

    const ing = { nombre, cantidad, unidad };
    const sustituciones = fila.querySelector('.ing-sustituciones').value
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (sustituciones.length > 0) ing.sustituciones = sustituciones;
    ingredientes.push(ing);
  }
  if (ingredientes.length === 0) return { error: 'Agregá al menos un ingrediente.' };

  const pasos = [];
  const filasPaso = [...listaPasos.querySelectorAll('.fila-paso')];
  for (let i = 0; i < filasPaso.length; i += 1) {
    const fila = filasPaso[i];
    const n = i + 1;
    const tipo = fila.querySelector('.paso-tipo').value;
    const contenido = fila.querySelector('.paso-contenido').value.trim();
    if (!contenido) return { error: `Paso ${n}: falta el contenido.` };

    // orden = posición; de cada paso solo se envían los campos de su tipo.
    const paso = { orden: n, tipo, contenido };
    if (tipo === 'temporizador') {
      const minutos = entero(fila.querySelector('.paso-minutos').value);
      if (!(minutos >= 0)) return { error: `Paso ${n}: los minutos deben ser un entero mayor o igual a 0.` };
      paso.minutos = minutos;
    } else if (tipo === 'video') {
      const url = fila.querySelector('.paso-url').value.trim();
      const segundos = entero(fila.querySelector('.paso-segundos').value);
      if (!urlHttp(url)) return { error: `Paso ${n}: la URL del video debe empezar con http:// o https://.` };
      if (!(segundos >= 0)) return { error: `Paso ${n}: los segundos deben ser un entero mayor o igual a 0.` };
      paso.url = url;
      paso.segundos = segundos;
    }
    pasos.push(paso);
  }
  if (pasos.length === 0) return { error: 'Agregá al menos un paso.' };

  const body = {
    titulo, porciones, tiempoPreparacionMin, tiempoCoccionMin,
    dificultad: campo('dificultad').value,
    categorias, ingredientes, pasos,
  };

  // Opcionales: vacío = se omite (no se envía ''), y el servidor lo $unsetea.
  const pais = campo('paisOrigen').value.trim();
  if (pais) {
    if (!/^[A-Za-z]{2}$/.test(pais)) return { error: 'El país debe ser un código de 2 letras (por ejemplo IT).' };
    body.paisOrigen = pais.toUpperCase();
  }

  const tipo = campo('tipo').value;
  if (tipo) {
    body.tipo = tipo;
    // Solo los campos del tipo elegido: los del tipo anterior no viajan.
    for (const nombre of CAMPOS_POR_TIPO[tipo]) {
      const valor = campo(nombre).value.trim();
      if (valor === '') continue;
      if (CAMPOS_ENTEROS_DE_TIPO.includes(nombre)) {
        const n = entero(valor);
        if (Number.isNaN(n)) return { error: 'La temperatura del horno debe ser un número entero.' };
        body[nombre] = n;
      } else {
        body[nombre] = valor;
      }
    }
  }

  return { body };
}

// ---------- Envío ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarAlerta(alertas);

  const { error, body } = armarBody();
  if (error) {
    mostrarError(alertas, { message: error });
    alertas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  btnGuardar.disabled = true;
  try {
    if (idEdicion) {
      await api.put(`/api/recetas/${encodeURIComponent(idEdicion)}`, body);
      location.assign(`/receta.html?id=${encodeURIComponent(idEdicion)}`);
    } else {
      const { receta } = await api.post('/api/recetas', body);
      location.assign(`/receta.html?id=${encodeURIComponent(receta._id)}`);
    }
  } catch (err) {
    mostrarError(alertas, err);
    alertas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btnGuardar.disabled = false;
  }
});

// ---------- Arranque ----------

async function iniciar() {
  const estado = await iniciarNav();
  // Sin sesión, nav.js redirige a login (la página figura en PAGINAS_PROTEGIDAS).
  if (!estado.autenticado) return;

  tituloPagina.textContent = idEdicion ? 'Editar receta' : 'Nueva receta';
  document.title = `${tituloPagina.textContent} — Recetario`;

  try {
    pintarCategorias(await cargarCategorias());
  } catch (err) {
    mostrarError(alertas, err);
    form.hidden = true; // sin catálogo no se puede elegir la categoría obligatoria
    return;
  }

  if (!idEdicion) {
    agregarIngrediente();
    agregarPaso();
    mostrarBloqueTipo();
    return;
  }

  try {
    const { receta } = await api.get(`/api/recetas/${encodeURIComponent(idEdicion)}`);
    if (receta.autor._id !== estado.usuario.id) {
      // Aviso temprano; la barrera real es el 403 del PUT.
      mostrarError(alertas, { message: 'Solo el autor de la receta puede editarla.' });
      form.hidden = true;
      return;
    }
    poblar(receta);
  } catch (err) {
    mostrarError(alertas, err);
    form.hidden = true;
  }
}

iniciar();
