const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');
const { eliminarRecetaYDependencias, eliminarOpinionYActualizarPuntaje } = require('./eliminaciones');

// Moderación: el moderador elimina contenido ajeno. Las rutas pasan por
// requireRolVigente('moderador'), que deja en req.usuarioActual el usuario
// leído de la base ({ _id, nombre, rol }). Cada handler verifica el conflicto
// de interés ANTES de llamar a los helpers de eliminaciones.js, que no deciden
// permisos.
//
// Orden en ambos handlers: leer contenido → conflicto de interés → validar
// motivo → insertar en moderaciones → borrar. Sin transacciones (Mongo local
// standalone): si el borrado falla después del insert, queda el registro sin
// el borrado, y un REINTENTO inserta otra entrada en moderaciones (duplica el
// registro). Se prefiere eso a borrar sin dejar rastro.

function manejarErrorEscritura(err, res) {
  if (err.code === 121) {
    console.error(JSON.stringify(err.errInfo, null, 2));
    return res.status(400).json({ ok: false, error: 'Los datos enviados no son válidos.' });
  }
  return res.status(500).json({ ok: false, error: err.message });
}

function leerMotivo(body) {
  return typeof body?.motivo === 'string' ? body.motivo.trim() : '';
}

async function eliminarReceta(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const receta = await getDb().collection('recetas').findOne({ _id: new ObjectId(req.params.id) });
    if (!receta) {
      return res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    }

    const moderador = req.usuarioActual;
    if (receta.autor._id.toString() === moderador._id.toString()) {
      return res.status(403).json({ ok: false, error: 'No podés moderar tu propia receta.' });
    }

    const motivo = leerMotivo(req.body);
    if (!motivo) {
      return res.status(400).json({ ok: false, error: 'El motivo es obligatorio.' });
    }

    await getDb().collection('moderaciones').insertOne({
      moderador: { _id: moderador._id, nombre: moderador.nombre },
      tipoContenido: 'receta',
      contenidoId: receta._id,
      motivo,
      instantanea: { autorNombre: receta.autor.nombre, recetaTitulo: receta.titulo },
      fecha: new Date(),
    });

    await eliminarRecetaYDependencias(getDb(), receta);

    res.json({ ok: true });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

async function eliminarOpinion(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const opinion = await getDb().collection('opiniones').findOne({ _id: new ObjectId(req.params.id) });
    if (!opinion) {
      return res.status(404).json({ ok: false, error: 'Opinión no encontrada.' });
    }
    const receta = await getDb().collection('recetas').findOne({ _id: opinion.recetaId });
    if (!receta) {
      return res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    }

    // Conflicto de interés: ni la opinión propia ni las opiniones sobre una
    // receta propia.
    const moderador = req.usuarioActual;
    if (
      opinion.usuario._id.toString() === moderador._id.toString()
      || receta.autor._id.toString() === moderador._id.toString()
    ) {
      return res.status(403).json({
        ok: false,
        error: 'No podés moderar tu propia opinión ni las opiniones de tu propia receta.',
      });
    }

    const motivo = leerMotivo(req.body);
    if (!motivo) {
      return res.status(400).json({ ok: false, error: 'El motivo es obligatorio.' });
    }

    await getDb().collection('moderaciones').insertOne({
      moderador: { _id: moderador._id, nombre: moderador.nombre },
      tipoContenido: 'opinion',
      contenidoId: opinion._id,
      motivo,
      instantanea: {
        autorNombre: opinion.usuario.nombre,
        recetaTitulo: receta.titulo,
        texto: opinion.comentario,
      },
      fecha: new Date(),
    });

    await eliminarOpinionYActualizarPuntaje(getDb(), opinion);

    res.json({ ok: true });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

module.exports = { eliminarReceta, eliminarOpinion };
