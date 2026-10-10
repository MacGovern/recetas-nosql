const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');
const { validarDatosCuenta } = require('./auth.controller');
const { enteroDesdeQuery } = require('../consultas/parametros');

// Administración de la plataforma. Las rutas pasan por requireRolVigente('admin'),
// que deja en req.usuarioActual el usuario leído de la base ({ _id, nombre, rol }).
// El admin no hereda de Usuario: acá no hay opiniones, favoritos ni recetas.

const SALT_ROUNDS = 10;
const ROLES_ASIGNABLES = ['usuario', 'moderador'];

// mensaje409: qué significa un 11000 en la escritura que falló.
function manejarErrorEscritura(err, res, mensaje409) {
  if (err.code === 11000 && mensaje409) {
    return res.status(409).json({ ok: false, error: mensaje409 });
  }
  if (err.code === 121) {
    console.error(JSON.stringify(err.errInfo, null, 2));
    return res.status(400).json({ ok: false, error: 'Los datos enviados no son válidos.' });
  }
  return res.status(500).json({ ok: false, error: err.message });
}

function leerPaginacion(query) {
  return {
    limit: enteroDesdeQuery(query.limit, 20, { min: 1, max: 50 }),
    skip: enteroDesdeQuery(query.skip, 0, { min: 0 }),
  };
}

// "Ñoquis y Pastá" -> "noquis-y-pasta". Cumple ^[a-z0-9]+(-[a-z0-9]+)*$ o
// queda vacío (nombre sin ninguna letra ni dígito ASCII tras quitar tildes).
function slugDesdeNombre(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function leerNombre(body) {
  return typeof body?.nombre === 'string' ? body.nombre.trim() : '';
}

// --- Usuarios ---

async function listarUsuarios(req, res) {
  try {
    const { limit, skip } = leerPaginacion(req.query);
    const usuarios = getDb().collection('usuarios');

    const [items, total] = await Promise.all([
      usuarios
        .find({}, { projection: { passwordHash: 0 } })
        .sort({ fechaRegistro: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      usuarios.countDocuments({}),
    ]);

    res.json({ ok: true, total, usuarios: items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// Solo entre 'usuario' y 'moderador'. Nunca toca cuentas admin (ni la propia)
// ni convierte a nadie en admin. El rol vigente se lee de la base en cada
// pedido, así que el cambio rige de inmediato para sesiones ya abiertas.
async function cambiarRol(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const rol = req.body?.rol;
    if (!ROLES_ASIGNABLES.includes(rol)) {
      return res.status(400).json({ ok: false, error: 'El rol debe ser usuario o moderador.' });
    }

    const objetivo = await getDb()
      .collection('usuarios')
      .findOne({ _id: new ObjectId(req.params.id) }, { projection: { nombre: 1, rol: 1 } });
    if (!objetivo) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
    }
    if (objetivo._id.toString() === req.usuarioActual._id.toString()) {
      return res.status(403).json({ ok: false, error: 'No podés cambiar tu propio rol.' });
    }
    if (objetivo.rol === 'admin') {
      return res.status(403).json({ ok: false, error: 'No se puede cambiar el rol de una cuenta de administrador.' });
    }

    await getDb().collection('usuarios').updateOne({ _id: objetivo._id }, { $set: { rol } });

    res.json({ ok: true, usuario: { id: objetivo._id, nombre: objetivo.nombre, rol } });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

// Crea una cuenta NUEVA con rol admin. No abre sesión (no reemplaza la del
// admin que la crea) y no usa registrar(): reutiliza solo las validaciones.
// El rol es el literal 'admin'; req.body.rol se ignora.
async function crearAdministrador(req, res) {
  try {
    const { error, nombre, email, password } = validarDatosCuenta(req.body || {});
    if (error) {
      return res.status(400).json({ ok: false, error });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const doc = {
      nombre,
      email,
      passwordHash,
      rol: 'admin',
      fechaRegistro: new Date(),
    };
    const { insertedId } = await getDb().collection('usuarios').insertOne(doc);

    res.status(201).json({ ok: true, usuario: { id: insertedId, nombre, email, rol: 'admin' } });
  } catch (err) {
    manejarErrorEscritura(err, res, 'Ese email ya está registrado.');
  }
}

// --- Categorías ---

async function crearCategoria(req, res) {
  try {
    const nombre = leerNombre(req.body);
    if (!nombre) {
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio.' });
    }
    // descripcion es obligatoria en el schema, pero puede ser un string vacío.
    if (typeof req.body.descripcion !== 'string') {
      return res.status(400).json({ ok: false, error: 'La descripción debe ser un texto (puede estar vacío).' });
    }
    const slug = slugDesdeNombre(nombre);
    if (!slug) {
      return res.status(400).json({ ok: false, error: 'El nombre debe contener letras o números.' });
    }

    // El índice único sobre slug es la barrera: un duplicado da 11000 → 409.
    const doc = { slug, nombre, descripcion: req.body.descripcion };
    const { insertedId } = await getDb().collection('categorias').insertOne(doc);

    res.status(201).json({ ok: true, categoria: { ...doc, _id: insertedId } });
  } catch (err) {
    manejarErrorEscritura(err, res, 'Ya existe una categoría con ese identificador (slug).');
  }
}

// Cambia nombre (y descripcion si viene). El slug NO cambia: puede estar en
// enlaces o datos externos y es el identificador estable de la categoría.
async function renombrarCategoria(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const nombre = leerNombre(req.body);
    if (!nombre) {
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio.' });
    }
    const cambios = { nombre };
    if (req.body.descripcion !== undefined) {
      if (typeof req.body.descripcion !== 'string') {
        return res.status(400).json({ ok: false, error: 'La descripción debe ser un texto (puede estar vacío).' });
      }
      cambios.descripcion = req.body.descripcion;
    }

    const _id = new ObjectId(req.params.id);
    const { matchedCount } = await getDb().collection('categorias').updateOne({ _id }, { $set: cambios });
    if (matchedCount === 0) {
      return res.status(404).json({ ok: false, error: 'Categoría no encontrada.' });
    }

    const categoria = await getDb().collection('categorias').findOne({ _id });
    res.json({ ok: true, categoria });
  } catch (err) {
    manejarErrorEscritura(err, res);
  }
}

// Se rechaza con 409 si alguna receta la usa: recetas.categorias es minItems 1,
// así que un $pull podría dejar una receta inválida (error 121). Entre el
// count y el delete otra receta podría empezar a usarla (sin transacciones):
// limitación aceptada.
async function eliminarCategoria(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Id inválido.' });
    }
    const _id = new ObjectId(req.params.id);
    const categoria = await getDb().collection('categorias').findOne({ _id });
    if (!categoria) {
      return res.status(404).json({ ok: false, error: 'Categoría no encontrada.' });
    }

    const enUso = await getDb().collection('recetas').countDocuments({ categorias: _id });
    if (enUso > 0) {
      return res.status(409).json({
        ok: false,
        error: `No se puede eliminar: ${enUso} receta(s) usan esta categoría.`,
        recetas: enUso,
      });
    }

    await getDb().collection('categorias').deleteOne({ _id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// --- Moderaciones ---

// Historial: fecha descendente, paginado, sin filtros. _id desempata para que
// la paginación sea estable con fechas iguales.
async function listarModeraciones(req, res) {
  try {
    const { limit, skip } = leerPaginacion(req.query);
    const moderaciones = getDb().collection('moderaciones');

    const [items, total] = await Promise.all([
      moderaciones.find({}).sort({ fecha: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      moderaciones.countDocuments({}),
    ]);

    res.json({ ok: true, total, moderaciones: items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  listarUsuarios,
  cambiarRol,
  crearAdministrador,
  crearCategoria,
  renombrarCategoria,
  eliminarCategoria,
  listarModeraciones,
};
