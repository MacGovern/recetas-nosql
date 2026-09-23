// Consulta 3 — Favoritos del usuario con los datos de cada receta.
// $lookup de usuarios contra recetas usando el array de ObjectId `favoritos`.
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');
const { PROYECCION_LISTADO } = require('../controllers/recetas.controller');

function armarPipeline(usuarioId) {
  return [
    { $match: { _id: usuarioId } },
    {
      $lookup: {
        from: 'recetas',
        localField: 'favoritos', // array de ObjectId: matchea contra cada elemento
        foreignField: '_id',
        pipeline: [{ $project: PROYECCION_LISTADO }],
        as: 'recetasFavoritas',
      },
    },
    { $project: { _id: 0, recetasFavoritas: 1 } },
  ];
}

async function favoritosDelUsuario(req, res) {
  try {
    const [resultado] = await getDb()
      .collection('usuarios')
      .aggregate(armarPipeline(new ObjectId(req.session.userId)))
      .toArray();
    res.json({ ok: true, favoritos: resultado?.recetasFavoritas || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { favoritosDelUsuario, armarPipeline };
