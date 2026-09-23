// Consulta 2 — Receta con sus últimas 10 opiniones.
// $lookup con pipeline interno: el $sort y $limit corren dentro del lookup,
// usando el índice { recetaId: 1, fecha: -1 }.
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');

function armarPipeline(recetaId) {
  return [
    { $match: { _id: recetaId } },
    {
      $lookup: {
        from: 'opiniones',
        let: { rid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$recetaId', '$$rid'] } } },
          { $sort: { fecha: -1 } },
          { $limit: 10 },
        ],
        as: 'opiniones',
      },
    },
  ];
}

async function recetaConOpiniones(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const [receta] = await getDb()
      .collection('recetas')
      .aggregate(armarPipeline(new ObjectId(req.params.id)))
      .toArray();
    if (!receta) {
      return res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    }
    res.json({ ok: true, receta });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { recetaConOpiniones, armarPipeline };
