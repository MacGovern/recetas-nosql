const { getDb } = require('../db/connection');

async function listar(req, res) {
  try {
    const categorias = await getDb()
      .collection('categorias')
      .find({}, { projection: { slug: 1, nombre: 1, descripcion: 1 } })
      .sort({ nombre: 1 })
      .toArray();

    res.json({ ok: true, categorias });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { listar };
