const bcrypt = require('bcrypt');
const { connect, close } = require('../connection');
const { setupDatabase } = require('../setup');
const { categorias, usuarios, recetas } = require('./data');

const SEED_PASSWORD = 'Test1234!';

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function insertCategorias(db) {
  const docs = categorias.map((c) => ({ slug: c.slug, nombre: c.nombre, descripcion: c.descripcion }));
  const { insertedIds } = await db.collection('categorias').insertMany(docs);
  const idPorSlug = {};
  categorias.forEach((c, i) => {
    idPorSlug[c.slug] = insertedIds[i];
  });
  return idPorSlug;
}

async function insertUsuarios(db) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const docs = usuarios.map((u) => ({
    nombre: u.nombre,
    email: u.email,
    passwordHash,
    rol: u.rol,
    fechaRegistro: daysAgo(u.fechaRegistroDiasAtras),
  }));
  const { insertedIds } = await db.collection('usuarios').insertMany(docs);
  // Embed parcial {_id, nombre} por posición, para autor/usuario/moderador.
  const refs = usuarios.map((u, i) => ({ _id: insertedIds[i], nombre: u.nombre }));
  return { insertedIds, refs };
}

function construirRecetaDoc(receta, usuarioRefs, idPorSlugCategoria) {
  const cantidad = receta.opiniones.length;
  const suma = receta.opiniones.reduce((acc, o) => acc + o.estrellas, 0);
  const promedio = cantidad > 0 ? Math.round((suma / cantidad) * 100) / 100 : 0;

  const doc = {
    titulo: receta.titulo,
    autor: usuarioRefs[receta.autorIndex],
    porciones: receta.porciones,
    tiempoPreparacionMin: receta.tiempoPreparacionMin,
    tiempoCoccionMin: receta.tiempoCoccionMin,
    dificultad: receta.dificultad,
    categorias: receta.categoriaSlugs.map((slug) => idPorSlugCategoria[slug]),
    ingredientes: receta.ingredientes,
    pasos: receta.pasos,
    puntaje: { suma, cantidad, promedio },
    fechaPublicacion: daysAgo(receta.fechaPublicacionDiasAtras),
  };

  // Solo los campos derivados del propio tipo, nunca los de otro tipo.
  if (receta.paisOrigen !== undefined) doc.paisOrigen = receta.paisOrigen;
  if (receta.tipo !== undefined) doc.tipo = receta.tipo;
  if (receta.temperaturaHornoC !== undefined) doc.temperaturaHornoC = receta.temperaturaHornoC;
  if (receta.tipoVaso !== undefined) doc.tipoVaso = receta.tipoVaso;
  if (receta.tipoLenia !== undefined) doc.tipoLenia = receta.tipoLenia;
  if (receta.puntoCoccion !== undefined) doc.puntoCoccion = receta.puntoCoccion;

  return doc;
}

async function insertRecetas(db, usuarioRefs, idPorSlugCategoria) {
  const docs = recetas.map((r) => construirRecetaDoc(r, usuarioRefs, idPorSlugCategoria));
  const { insertedIds } = await db.collection('recetas').insertMany(docs);
  return recetas.map((_, i) => insertedIds[i]);
}

async function insertOpiniones(db, recetaIds, usuarioRefs) {
  const docs = [];
  recetas.forEach((receta, i) => {
    receta.opiniones.forEach((o) => {
      docs.push({
        recetaId: recetaIds[i],
        usuario: usuarioRefs[o.usuarioIndex],
        comentario: o.comentario,
        estrellas: o.estrellas,
        fecha: daysAgo(o.fechaDiasAtras),
      });
    });
  });
  await db.collection('opiniones').insertMany(docs);
  return docs.length;
}

// Índices de receta (no de usuario) que cada usuario deja como favorito.
// Ninguno coincide con recetas de su propia autoría.
const FAVORITOS = [
  { usuarioIndex: 0, recetaIndices: [1, 7, 10] },
  { usuarioIndex: 2, recetaIndices: [0, 6] },
  { usuarioIndex: 4, recetaIndices: [3, 9, 11] },
];

async function insertFavoritos(db, usuarioInsertedIds, recetaIds) {
  for (const { usuarioIndex, recetaIndices } of FAVORITOS) {
    await db.collection('usuarios').updateOne(
      { _id: usuarioInsertedIds[usuarioIndex] },
      { $addToSet: { favoritos: { $each: recetaIndices.map((i) => recetaIds[i]) } } },
    );
  }
}

async function seed() {
  const db = await connect();
  await setupDatabase(db, { force: true });

  const idPorSlugCategoria = await insertCategorias(db);
  const { insertedIds: usuarioInsertedIds, refs: usuarioRefs } = await insertUsuarios(db);
  const recetaIds = await insertRecetas(db, usuarioRefs, idPorSlugCategoria);
  const cantidadOpiniones = await insertOpiniones(db, recetaIds, usuarioRefs);
  await insertFavoritos(db, usuarioInsertedIds, recetaIds);

  console.log('Base "recetario" sembrada con éxito:');
  console.log(`  - ${categorias.length} categorías`);
  console.log(`  - ${usuarios.length} usuarios (contraseña de prueba para todos: ${SEED_PASSWORD})`);
  usuarios.forEach((u) => console.log(`      ${u.rol.padEnd(9)} ${u.email}`));
  console.log(`  - ${recetas.length} recetas`);
  console.log(`  - ${cantidadOpiniones} opiniones`);
}

if (require.main === module) {
  seed()
    .then(() => close())
    .catch(async (err) => {
      console.error('Error al sembrar la base:', err.message);
      if (err.errInfo) {
        console.error(JSON.stringify(err.errInfo, null, 2));
      }
      process.exitCode = 1;
      await close();
    });
}

module.exports = { seed };
