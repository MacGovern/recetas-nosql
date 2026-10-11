const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');

async function agregarFavorito(req, res) {
  try {
    if (!ObjectId.isValid(req.params.recetaId)) {
      return res.status(400).json({ ok: false, error: 'Id de receta inválido.' });
    }
    const recetaId = new ObjectId(req.params.recetaId);

    const receta = await getDb().collection('recetas').findOne({ _id: recetaId });
    if (!receta) {
      return res.status(404).json({ ok: false, error: 'Receta no encontrada.' });
    }

    await getDb().collection('usuarios').updateOne(
      { _id: new ObjectId(req.session.userId) },
      { $addToSet: { favoritos: recetaId } },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function quitarFavorito(req, res) {
  try {
    if (!ObjectId.isValid(req.params.recetaId)) {
      return res.status(400).json({ ok: false, error: 'Id de receta inválido.' });
    }
    const recetaId = new ObjectId(req.params.recetaId);

    await getDb().collection('usuarios').updateOne(
      { _id: new ObjectId(req.session.userId) },
      { $pull: { favoritos: recetaId } },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function listarFavoritos(req, res) {
  try {
    const usuario = await getDb()
      .collection('usuarios')
      .findOne({ _id: new ObjectId(req.session.userId) }, { projection: { favoritos: 1 } });
    res.json({ ok: true, favoritos: usuario?.favoritos || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { agregarFavorito, quitarFavorito, listarFavoritos };
