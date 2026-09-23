// Consulta 6 — Recetas que se pueden cocinar con los ingredientes que el
// usuario tiene. $setIsSubset dice si todos los ingredientes de la receta
// están en la lista; $setDifference dice cuáles faltan.
const { getDb } = require('../db/connection');
const { PROYECCION_LISTADO } = require('../controllers/recetas.controller');
const { listaDesdeQuery, enteroDesdeQuery } = require('./parametros');

function armarPipeline(tengo, maxFaltantes) {
  return [
    { $addFields: { nombres: { $map: { input: '$ingredientes', as: 'i', in: '$$i.nombre' } } } },
    {
      $addFields: {
        cocinable: { $setIsSubset: ['$nombres', tengo] },
        faltantes: { $setDifference: ['$nombres', tengo] },
      },
    },
    { $addFields: { cantidadFaltantes: { $size: '$faltantes' } } },
    { $match: { cantidadFaltantes: { $lte: maxFaltantes } } },
    { $project: { ...PROYECCION_LISTADO, cocinable: 1, faltantes: 1, cantidadFaltantes: 1 } },
    { $sort: { cantidadFaltantes: 1, 'puntaje.promedio': -1 } },
  ];
}

async function recetasCocinables(req, res) {
  try {
    const tengo = listaDesdeQuery(req.query.tengo);
    if (tengo.length === 0) {
      return res.status(400).json({ ok: false, error: 'Indicá al menos un ingrediente en "tengo".' });
    }
    const maxFaltantes = enteroDesdeQuery(req.query.maxFaltantes, 0, { min: 0 });
    const recetas = await getDb()
      .collection('recetas')
      .aggregate(armarPipeline(tengo, maxFaltantes))
      .toArray();
    res.json({ ok: true, recetas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { recetasCocinables, armarPipeline };
