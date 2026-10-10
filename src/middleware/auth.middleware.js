const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ ok: false, error: 'No autenticado.' });
  }
  next();
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ ok: false, error: 'No autenticado.' });
    }
    if (!rolesPermitidos.includes(req.session.rol)) {
      return res.status(403).json({ ok: false, error: 'No tenés permiso para esta acción.' });
    }
    next();
  };
}

// Como requireRole, pero lee el rol de la colección usuarios en cada pedido
// en lugar de confiar en req.session.rol: si un admin cambia el rol de
// alguien, la sesión ya abierta deja de valer al instante. Si el usuario ya
// no existe, 401. Deja el usuario vigente en req.usuarioActual
// ({ _id, nombre, rol }) para que el controlador no vuelva a leerlo.
function requireRolVigente(...rolesPermitidos) {
  return async (req, res, next) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ ok: false, error: 'No autenticado.' });
      }
      const usuario = await getDb()
        .collection('usuarios')
        .findOne({ _id: new ObjectId(req.session.userId) }, { projection: { nombre: 1, rol: 1 } });
      if (!usuario) {
        return res.status(401).json({ ok: false, error: 'No autenticado.' });
      }
      if (!rolesPermitidos.includes(usuario.rol)) {
        return res.status(403).json({ ok: false, error: 'No tenés permiso para esta acción.' });
      }
      req.usuarioActual = usuario;
      next();
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  };
}

module.exports = { requireAuth, requireRole, requireRolVigente };
