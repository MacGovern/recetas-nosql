const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');
const { eliminarRecetaYDependencias } = require('./eliminaciones');

const DIFICULTADES = ['facil', 'media', 'dificil'];
const TIPOS = ['horno', 'trago', 'asado', 'olla'];
const TIPOS_PASO = ['texto', 'temporizador', 'video'];

// Campos derivados por tipo. Los que no figuran para el tipo final se
// $unset explícitamente al editar, para no dejar mezcla de dos tipos.
const CAMPOS_VARIABLES = ['temperaturaHornoC', 'tipoVaso', 'tipoLenia', 'puntoCoccion'];
const CAMPOS_POR_TIPO = {
  horno: ['temperaturaHornoC'],
  trago: ['tipoVaso'],
  asado: ['tipoLenia', 'puntoCoccion'],
  olla: [],
};

const PROYECCION_LISTADO = {
  titulo: 1,
  autor: 1,
  categorias: 1,
  dificultad: 1,
  paisOrigen: 1,
  tipo: 1,
  tiempoPreparacionMin: 1,
  tiempoCoccionMin: 1,
  'puntaje.promedio': 1,
  fechaPublicacion: 1,
};

function validarPaso(paso, index) {
  if (!paso || typeof paso !== 'object') {
    return `El paso ${index + 1} no es válido.`;
  }
  if (!Number.isInteger(paso.orden) || paso.orden < 1) {
    return `El paso ${index + 1} necesita un "orden" entero mayor o igual a 1.`;
  }
  if (!TIPOS_PASO.includes(paso.tipo)) {
    return `El paso ${index + 1} tiene un "tipo" inválido.`;
  }
  if (typeof paso.contenido !== 'string' || !paso.contenido.trim()) {
    return `El paso ${index + 1} necesita "contenido".`;
  }
  if (paso.tipo === 'temporizador' && !Number.isInteger(paso.minutos)) {
    return `El paso ${index + 1} (temporizador) necesita "minutos" entero.`;
  }
  if (paso.tipo === 'video') {
    if (typeof paso.url !== 'string' || !paso.url.trim()) {
      return `El paso ${index + 1} (video) necesita "url".`;
    }
    if (!Number.isInteger(paso.segundos)) {
      return `El paso ${index + 1} (video) necesita "segundos" entero.`;
    }
  }
  return null;
}

function validarIngrediente(ingrediente, index) {
  if (!ingrediente || typeof ingrediente !== 'object') {
    return `El ingrediente ${index + 1} no es válido.`;
  }
  if (typeof ingrediente.nombre !== 'string' || !ingrediente.nombre.trim()) {
    return `El ingrediente ${index + 1} necesita "nombre".`;
  }
  if (typeof ingrediente.cantidad !== 'number' || ingrediente.cantidad < 0) {
    return `El ingrediente ${index + 1} necesita "cantidad" numérica.`;
  }
  if (typeof ingrediente.unidad !== 'string' || !ingrediente.unidad.trim()) {
    return `El ingrediente ${index + 1} necesita "unidad".`;
  }
  if (ingrediente.sustituciones !== undefined) {
    if (!Array.isArray(ingrediente.sustituciones) || ingrediente.sustituciones.some((s) => typeof s !== 'string')) {
      return `El ingrediente ${index + 1} tiene "sustituciones" inválidas.`;
    }
  }
  return null;
}

// Valida el body de creación/edición y arma los campos "planos" (sin autor,
// puntaje, fechaPublicacion, _id: esos los controla el servidor). Devuelve
// { error } o { datos, categoriasIds }.
async function validarYArmarDatos(body) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) {
    return { error: 'El título es obligatorio.' };
  }
  if (!DIFICULTADES.includes(body.dificultad)) {
    return { error: 'La dificultad debe ser facil, media o dificil.' };
  }
  if (!Number.isInteger(body.porciones) || body.porciones < 1) {
    return { error: 'Las porciones deben ser un entero mayor o igual a 1.' };
  }
  if (!Number.isInteger(body.tiempoPreparacionMin) || body.tiempoPreparacionMin < 0) {
    return { error: 'El tiempo de preparación debe ser un entero mayor o igual a 0.' };
  }
  if (!Number.isInteger(body.tiempoCoccionMin) || body.tiempoCoccionMin < 0) {
    return { error: 'El tiempo de cocción debe ser un entero mayor o igual a 0.' };
  }

  let paisOrigen;
  if (body.paisOrigen !== undefined) {
    if (typeof body.paisOrigen !== 'string' || body.paisOrigen.length !== 2) {
      return { error: 'El país de origen debe ser un código ISO 3166-1 alfa-2.' };
    }
    paisOrigen = body.paisOrigen.toUpperCase();
  }

  let tipo;
  if (body.tipo !== undefined) {
    if (!TIPOS.includes(body.tipo)) {
      return { error: 'El tipo debe ser horno, trago, asado u olla.' };
    }
    tipo = body.tipo;
  }

  if (!Array.isArray(body.categorias) || body.categorias.length === 0) {
    return { error: 'Debe indicarse al menos una categoría.' };
  }
  if (body.categorias.some((c) => typeof c !== 'string' || !ObjectId.isValid(c))) {
    return { error: 'Alguna categoría tiene un id inválido.' };
  }
  const categoriasIds = body.categorias.map((c) => new ObjectId(c));
  const cantidadEncontrada = await getDb()
    .collection('categorias')
    .countDocuments({ _id: { $in: categoriasIds } });
  if (cantidadEncontrada !== new Set(categoriasIds.map((id) => id.toString())).size) {
    return { error: 'Alguna categoría no existe.' };
  }

  if (!Array.isArray(body.ingredientes) || body.ingredientes.length === 0) {
    return { error: 'Debe indicarse al menos un ingrediente.' };
  }
  for (let i = 0; i < body.ingredientes.length; i += 1) {
    const err = validarIngrediente(body.ingredientes[i], i);
    if (err) return { error: err };
  }

  if (!Array.isArray(body.pasos) || body.pasos.length === 0) {
    return { error: 'Debe indicarse al menos un paso.' };
  }
  for (let i = 0; i < body.pasos.length; i += 1) {
    const err = validarPaso(body.pasos[i], i);
    if (err) return { error: err };
  }

  const datos = {
    titulo,
    porciones: body.porciones,
    tiempoPreparacionMin: body.tiempoPreparacionMin,
    tiempoCoccionMin: body.tiempoCoccionMin,
    dificultad: body.dificultad,
    categorias: categoriasIds,
    // Nombre en minúsculas y sin espacios sobrantes: la consulta 5 agrupa por
    // nombre exacto, así que "Sal" y "sal" serían ingredientes distintos.
    ingredientes: body.ingredientes.map((ing) => ({ ...ing, nombre: ing.nombre.trim().toLowerCase() })),
    pasos: body.pasos,
  };
  if (paisOrigen !== undefined) datos.paisOrigen = paisOrigen;
  if (tipo !== undefined) datos.tipo = tipo;

  const camposDelTipo = tipo ? CAMPOS_POR_TIPO[tipo] : [];
  for (const campo of camposDelTipo) {
    if (body[campo] !== undefined) {
      datos[campo] = body[campo];
    }
  }

  return { datos, tipo, camposDelTipo };
}

function manejarErrorEscritura(err, res) {
  if (err.code === 121) {
    console.error(JSON.stringify(err.errInfo, null, 2));
    return res.status(400).json({ ok: false, error: 'Los datos enviados no son válidos.' });
  }
  return res.status(500).json({ ok: false, error: err.message });
}

async function crear(req, res) {
  try {
    const { error, datos } = await validarYArmarDatos(req.body || {});
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    const doc = {
      ...datos,
      autor: { _id: new ObjectId(req.session.userId), nombre: req.session.nombre },
      puntaje: { suma: 0, cantidad: 0, promedio: 0 },
      fechaPublicacion: new Date(),
    };

    const { insertedId } = await getDb().collection('recetas').insertOne(doc);
    res.status(201).json({ ok: true, receta: { ...doc, _id: insertedId } });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

async function listar(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const recetas = await getDb()
      .collection('recetas')
      .find({}, { projection: PROYECCION_LISTADO })
      .sort({ fechaPublicacion: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({ ok: true, recetas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function obtenerPorId(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const receta = await getDb().collection('recetas').findOne({ _id: new ObjectId(req.params.id) });
    if (!receta) {
      return res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    }
    res.json({ ok: true, receta });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function buscarRecetaYVerificarAutoria(req, res) {
  if (!ObjectId.isValid(req.params.id)) {
    res.status(400).json({ ok: false, error: 'Id inválido.' });
    return null;
  }
  const receta = await getDb().collection('recetas').findOne({ _id: new ObjectId(req.params.id) });
  if (!receta) {
    res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    return null;
  }
  if (receta.autor._id.toString() !== req.session.userId) {
    res.status(403).json({ ok: false, error: 'No sos el autor de esta receta.' });
    return null;
  }
  return receta;
}

async function actualizar(req, res) {
  try {
    const receta = await buscarRecetaYVerificarAutoria(req, res);
    if (!receta) return;

    const { error, datos, camposDelTipo } = await validarYArmarDatos(req.body || {});
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    const campoAUnset = CAMPOS_VARIABLES.filter((campo) => !camposDelTipo.includes(campo));
    const update = { $set: datos };
    if (campoAUnset.length > 0) {
      update.$unset = Object.fromEntries(campoAUnset.map((campo) => [campo, '']));
    }
    if (datos.tipo === undefined) {
      update.$unset = { ...update.$unset, tipo: '' };
    }
    if (datos.paisOrigen === undefined) {
      update.$unset = { ...update.$unset, paisOrigen: '' };
    }

    await getDb().collection('recetas').updateOne({ _id: receta._id }, update);
    const actualizada = await getDb().collection('recetas').findOne({ _id: receta._id });
    res.json({ ok: true, receta: actualizada });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

async function eliminar(req, res) {
  try {
    const receta = await buscarRecetaYVerificarAutoria(req, res);
    if (!receta) return;

    await eliminarRecetaYDependencias(getDb(), receta);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { crear, listar, obtenerPorId, actualizar, eliminar, PROYECCION_LISTADO };
