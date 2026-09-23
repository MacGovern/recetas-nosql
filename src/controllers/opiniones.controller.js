const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');

function manejarErrorEscritura(err, res) {
  if (err.code === 11000) {
    return res.status(409).json({ ok: false, error: 'Ya opinaste esta receta.' });
  }
  if (err.code === 121) {
    console.error(JSON.stringify(err.errInfo, null, 2));
    return res.status(400).json({ ok: false, error: 'Los datos enviados no son válidos.' });
  }
  return res.status(500).json({ ok: false, error: err.message });
}

function validarComentarioYEstrellas(body) {
  const comentario = typeof body.comentario === 'string' ? body.comentario.trim() : '';
  if (!comentario) {
    return { error: 'El comentario es obligatorio.' };
  }
  if (!Number.isInteger(body.estrellas) || body.estrellas < 1 || body.estrellas > 5) {
    return { error: 'Las estrellas deben ser un entero entre 1 y 5.' };
  }
  return { comentario, estrellas: body.estrellas };
}

async function buscarOpinionYVerificarPropiedad(req, res) {
  if (!ObjectId.isValid(req.params.id)) {
    res.status(400).json({ ok: false, error: 'Id inválido.' });
    return null;
  }
  const opinion = await getDb().collection('opiniones').findOne({ _id: new ObjectId(req.params.id) });
  if (!opinion) {
    res.status(404).json({ ok: false, error: 'Opinión no encontrada.' });
    return null;
  }
  if (opinion.usuario._id.toString() !== req.session.userId) {
    res.status(403).json({ ok: false, error: 'No sos el autor de esta opinión.' });
    return null;
  }
  return opinion;
}

async function crear(req, res) {
  try {
    if (!ObjectId.isValid(req.body.recetaId)) {
      return res.status(400).json({ ok: false, error: 'recetaId inválido.' });
    }
    const recetaId = new ObjectId(req.body.recetaId);
    const receta = await getDb().collection('recetas').findOne({ _id: recetaId });
    if (!receta) {
      return res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    }
    if (receta.autor._id.toString() === req.session.userId) {
      return res.status(403).json({ ok: false, error: 'No podés opinar tu propia receta.' });
    }

    const { error, comentario, estrellas } = validarComentarioYEstrellas(req.body || {});
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    const doc = {
      recetaId,
      usuario: { _id: new ObjectId(req.session.userId), nombre: req.session.nombre },
      comentario,
      estrellas,
      fecha: new Date(),
    };
    const { insertedId } = await getDb().collection('opiniones').insertOne(doc);

    // Si este updateOne fallara después de que el insertOne de arriba ya se
    // confirmó, el puntaje quedaría desfasado respecto a las opiniones
    // reales hasta el próximo recálculo periódico (ver documentación del
    // grupo, secciones 4.2/5.2) — no hay transacción entre ambas escrituras
    // porque Mongo local corre standalone, sin replica set.
    await getDb().collection('recetas').updateOne({ _id: recetaId }, [
      {
        $set: {
          'puntaje.suma': { $add: ['$puntaje.suma', estrellas] },
          'puntaje.cantidad': { $add: ['$puntaje.cantidad', 1] },
        },
      },
      {
        $set: {
          'puntaje.promedio': { $round: [{ $divide: ['$puntaje.suma', '$puntaje.cantidad'] }, 2] },
        },
      },
    ]);

    res.status(201).json({ ok: true, opinion: { ...doc, _id: insertedId } });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

async function listar(req, res) {
  try {
    if (!ObjectId.isValid(req.query.recetaId)) {
      return res.status(400).json({ ok: false, error: 'recetaId inválido.' });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const opiniones = await getDb()
      .collection('opiniones')
      .find({ recetaId: new ObjectId(req.query.recetaId) })
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({ ok: true, opiniones });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function actualizar(req, res) {
  try {
    const opinion = await buscarOpinionYVerificarPropiedad(req, res);
    if (!opinion) return;

    const { error, comentario, estrellas } = validarComentarioYEstrellas(req.body || {});
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    await getDb().collection('opiniones').updateOne(
      { _id: opinion._id },
      { $set: { comentario, estrellas } },
    );

    const diferencia = estrellas - opinion.estrellas;
    if (diferencia !== 0) {
      await getDb().collection('recetas').updateOne({ _id: opinion.recetaId }, [
        { $set: { 'puntaje.suma': { $add: ['$puntaje.suma', diferencia] } } },
        {
          $set: {
            'puntaje.promedio': { $round: [{ $divide: ['$puntaje.suma', '$puntaje.cantidad'] }, 2] },
          },
        },
      ]);
    }

    const actualizada = await getDb().collection('opiniones').findOne({ _id: opinion._id });
    res.json({ ok: true, opinion: actualizada });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

async function eliminar(req, res) {
  try {
    const opinion = await buscarOpinionYVerificarPropiedad(req, res);
    if (!opinion) return;

    await getDb().collection('opiniones').deleteOne({ _id: opinion._id });

    await getDb().collection('recetas').updateOne({ _id: opinion.recetaId }, [
      {
        $set: {
          'puntaje.suma': { $subtract: ['$puntaje.suma', opinion.estrellas] },
          'puntaje.cantidad': { $subtract: ['$puntaje.cantidad', 1] },
        },
      },
      {
        $set: {
          'puntaje.promedio': {
            $cond: [
              { $eq: ['$puntaje.cantidad', 0] },
              0,
              { $round: [{ $divide: ['$puntaje.suma', '$puntaje.cantidad'] }, 2] },
            ],
          },
        },
      },
    ]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { crear, listar, actualizar, eliminar };
