// Consulta 1 — Buscar recetas.
// find con $all (ingredientes y categorías), país, texto opcional, orden y
// proyección reducida. Es un find y no un aggregate: no hay etapas que
// justifiquen un pipeline.
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');
const { PROYECCION_LISTADO } = require('../controllers/recetas.controller');
const { listaDesdeQuery, enteroDesdeQuery, regexPalabraCompleta } = require('./parametros');

// El "tiempo total" no está precalculado en el modelo, así que el orden por
// tiempo se hace por preparación.
const ORDENES = {
  puntaje: { 'puntaje.promedio': -1 },
  fecha: { fechaPublicacion: -1 },
  preparacion: { tiempoPreparacionMin: 1 },
};

async function buscarRecetas(req, res) {
  try {
    const ingredientes = listaDesdeQuery(req.query.ingredientes);
    const categorias = typeof req.query.categorias === 'string'
      ? req.query.categorias.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (categorias.some((c) => !ObjectId.isValid(c))) {
      return res.status(400).json({ ok: false, error: 'Alguna categoría tiene un id inválido.' });
    }
    const orden = req.query.orden || 'puntaje';
    if (!ORDENES[orden]) {
      return res.status(400).json({ ok: false, error: 'El orden debe ser puntaje, fecha o preparacion.' });
    }

    const filtro = {};
    // Cada término se busca como PALABRA COMPLETA, insensible a mayúsculas, y
    // no como string exacto: con $all de strings literales, buscar "pollo" no
    // encontraba "pollo entero". Se mantiene $all, así que la receta debe
    // cumplir TODOS los términos; lo que cambia es que cada elemento del array
    // pasa a ser un $regex (ver regexPalabraCompleta en parametros.js).
    //
    // Costo: un regex que no está anclado al inicio (y además con /i) no puede
    // acotar un rango del índice multikey { "ingredientes.nombre": 1 }: en lugar
    // de saltar a las claves buscadas, recorre las claves del índice (o la
    // colección). Es irrelevante con el volumen del seed, pero queda anotado
    // para la reflexión final del documento del grupo (la sección 5.1 usaba
    // $all con igualdad exacta, que sí aprovechaba el índice).
    if (ingredientes.length > 0) {
      filtro['ingredientes.nombre'] = { $all: ingredientes.map(regexPalabraCompleta) };
    }
    if (categorias.length > 0) filtro.categorias = { $all: categorias.map((c) => new ObjectId(c)) };
    if (typeof req.query.pais === 'string' && req.query.pais) filtro.paisOrigen = req.query.pais.toUpperCase();
    if (typeof req.query.q === 'string' && req.query.q.trim()) filtro.$text = { $search: req.query.q.trim() };

    const limit = enteroDesdeQuery(req.query.limit, 20, { min: 1, max: 50 });
    const skip = enteroDesdeQuery(req.query.skip, 0);

    const recetas = await getDb()
      .collection('recetas')
      .find(filtro, { projection: PROYECCION_LISTADO })
      .sort(ORDENES[orden])
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({ ok: true, recetas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { buscarRecetas };
