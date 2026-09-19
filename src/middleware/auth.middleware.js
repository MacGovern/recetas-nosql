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

module.exports = { requireAuth, requireRole };
