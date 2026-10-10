const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
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

// Valida y normaliza nombre, email y contraseña de una cuenta nueva. La usan
// el registro público y la alta de administradores. Devuelve { error } o
// { nombre, email, password }.
function validarDatosCuenta(body) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!nombre) {
    return { error: 'El nombre es obligatorio.' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'El email no tiene un formato válido.' };
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  return { nombre, email, password };
}

async function registrar(req, res) {
  const { error, nombre, email, password } = validarDatosCuenta(req.body || {});
  if (error) {
    return res.status(400).json({ ok: false, error });
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

// Nombre y rol se leen de la colección usuarios, no de la sesión: si un admin
// cambió el rol, /me ya devuelve el nuevo sin volver a loguearse. Si el
// usuario ya no existe, la sesión no vale: authenticated:false.
async function me(req, res) {
  try {
    if (!req.session?.userId) {
      return res.json({ authenticated: false });
    }
    const usuario = await getDb()
      .collection('usuarios')
      .findOne({ _id: new ObjectId(req.session.userId) }, { projection: { nombre: 1, rol: 1 } });
    if (!usuario) {
      return res.json({ authenticated: false });
    }
    res.json({
      authenticated: true,
      usuario: { id: usuario._id, nombre: usuario.nombre, rol: usuario.rol },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { registrar, login, logout, me, validarDatosCuenta };
