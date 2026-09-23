// Consulta 4 — Ranking por categoría con las 3 mejores recetas de cada una.
// Solo cuentan las recetas con al menos `minOpiniones` opiniones (sección 5.4
// del documento del grupo): sin ese filtro una receta con una única opinión de
// 5 estrellas encabezaría el ranking. Usa los contadores materializados de
// `puntaje`; no relee opiniones.
const { getDb } = require('../db/connection');
const { enteroDesdeQuery } = require('./parametros');

function armarPipeline(minOpiniones) {
  return [
    // 1. Filtro por receta, ANTES de agrupar.
    { $match: { 'puntaje.cantidad': { $gte: minOpiniones } } },
    // 2. Orden previo al $group: $push conserva este orden, así top3 sale ordenado.
    { $sort: { 'puntaje.promedio': -1, titulo: 1 } },
    // 3. Una fila por (receta, categoría).
    { $unwind: '$categorias' },
    // 4. Agrupar por categoría.
    {
      $group: {
        _id: '$categorias',
        sumaEstrellas: { $sum: '$puntaje.suma' },
        cantidadOpiniones: { $sum: '$puntaje.cantidad' },
        cantidadRecetas: { $sum: 1 },
        top3: { $push: { _id: '$_id', titulo: '$titulo', promedio: '$puntaje.promedio' } },
      },
    },
    // 5. Filtro adicional a nivel categoría: que no aparezcan categorías con
    //    pocas opiniones calificadas.
    { $match: { cantidadOpiniones: { $gte: minOpiniones } } },
    // 6. Promedio ponderado de la categoría y recorte a 3 recetas.
    {
      $addFields: {
        promedio: { $round: [{ $divide: ['$sumaEstrellas', '$cantidadOpiniones'] }, 2] },
        top3: { $slice: ['$top3', 3] },
      },
    },
    // 7. Datos de la categoría.
    { $lookup: { from: 'categorias', localField: '_id', foreignField: '_id', as: 'categoria' } },
    { $unwind: '$categoria' },
    {
      $project: {
        _id: 0,
        categoria: { _id: '$categoria._id', slug: '$categoria.slug', nombre: '$categoria.nombre' },
        promedio: 1,
        cantidadOpiniones: 1,
        cantidadRecetas: 1,
        top3: 1,
      },
    },
    { $sort: { promedio: -1, 'categoria.nombre': 1 } },
  ];
}

async function rankingPorCategoria(req, res) {
  try {
    const minOpiniones = enteroDesdeQuery(req.query.minOpiniones, 5, { min: 1 });
    const ranking = await getDb()
      .collection('recetas')
      .aggregate(armarPipeline(minOpiniones))
      .toArray();
    res.json({ ok: true, minOpiniones, ranking });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { rankingPorCategoria, armarPipeline };
