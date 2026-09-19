const bcrypt = require('bcrypt');
const { getDb } = require('../db/connection');

const SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function abrirSesion(req, usuario) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = usuario._id.toString();
      req.session.rol = usuario.rol;
      req.session.nombre = usuario.nombre;
      req.session.save((err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

async function registrar(req, res) {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!nombre) {
    return res.status(400).json({ ok: false, error: 'El nombre es obligatorio.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ ok: false, error: 'El email no tiene un formato válido.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const doc = {
      nombre,
      email,
      passwordHash,
      rol: 'usuario',
      fechaRegistro: new Date(),
    };
    const { insertedId } = await getDb().collection('usuarios').insertOne(doc);
    await abrirSesion(req, { _id: insertedId, rol: doc.rol, nombre: doc.nombre });
    res.status(201).json({ ok: true, usuario: { id: insertedId, nombre, email, rol: 'usuario' } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ ok: false, error: 'Ese email ya está registrado.' });
    }
    if (err.code === 121) {
      console.error(JSON.stringify(err.errInfo, null, 2));
      return res.status(400).json({ ok: false, error: 'Los datos enviados no son válidos.' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function login(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email y contraseña son obligatorios.' });
  }

  try {
    const usuario = await getDb().collection('usuarios').findOne({ email });
    const coincide = usuario ? await bcrypt.compare(password, usuario.passwordHash) : false;
    if (!usuario || !coincide) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas.' });
    }
    await abrirSesion(req, usuario);
    res.json({ ok: true, usuario: { id: usuario._id, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ ok: false, error: 'No se pudo cerrar la sesión.' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
}

function me(req, res) {
  if (!req.session?.userId) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    usuario: { id: req.session.userId, nombre: req.session.nombre, rol: req.session.rol },
  });
}

module.exports = { registrar, login, logout, me };
