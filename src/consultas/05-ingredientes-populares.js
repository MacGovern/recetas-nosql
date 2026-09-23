// Consulta 5 — Ingredientes más usados en las recetas.
const { getDb } = require('../db/connection');
const { enteroDesdeQuery } = require('./parametros');

function armarPipeline(limite) {
  return [
    { $unwind: '$ingredientes' },
    { $group: { _id: '$ingredientes.nombre', recetas: { $sum: 1 } } },
    { $sort: { recetas: -1, _id: 1 } }, // desempate estable por nombre
    { $limit: limite },
    { $project: { _id: 0, ingrediente: '$_id', recetas: 1 } },
  ];
}

async function ingredientesPopulares(req, res) {
  try {
    const limite = enteroDesdeQuery(req.query.limit, 10, { min: 1, max: 50 });
    const ingredientes = await getDb()
      .collection('recetas')
      .aggregate(armarPipeline(limite))
      .toArray();
    res.json({ ok: true, ingredientes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { ingredientesPopulares, armarPipeline };
