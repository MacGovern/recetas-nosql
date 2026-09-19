const { connect, close } = require('./connection');
const collectionSchemas = require('./schemas');
const { indexDefinitions } = require('./indexes');

async function assertEmpty(db) {
  for (const name of Object.keys(collectionSchemas)) {
    const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
    if (existing.length === 0) continue;
    const count = await db.collection(name).countDocuments();
    if (count > 0) {
      throw new Error(
        `La colección "${name}" tiene ${count} documento(s). Abortando para no perder datos. ` +
        'Volvé a correr con --force si querés dropear igual.'
      );
    }
  }
}

async function dropCollections(db) {
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existing.map((c) => c.name));
  for (const name of Object.keys(collectionSchemas)) {
    if (existingNames.has(name)) {
      await db.collection(name).drop();
    }
  }
}

async function createCollectionsWithValidators(db) {
  for (const [name, schema] of Object.entries(collectionSchemas)) {
    await db.createCollection(name, {
      validator: schema,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
}

async function createIndexes(db) {
  for (const [name, defs] of Object.entries(indexDefinitions)) {
    const collection = db.collection(name);
    for (const { key, options } of defs) {
      await collection.createIndex(key, options || {});
    }
  }
}

/**
 * Deja la base "recetario" en un estado limpio: borra las 5 colecciones si
 * existen, las recrea con sus validadores $jsonSchema, y crea los índices.
 * No carga datos — eso es responsabilidad de scripts/seed.js (Etapa 2), que
 * importa y llama a esta misma función antes de insertar documentos.
 *
 * Por defecto aborta sin tocar nada si alguna colección ya tiene documentos,
 * para no perder datos de prueba por correr esto de más. { force: true }
 * salta esa guarda.
 */
async function setupDatabase(db, { force = false } = {}) {
  const activeDb = db || (await connect());
  if (!force) {
    await assertEmpty(activeDb);
  }
  await dropCollections(activeDb);
  await createCollectionsWithValidators(activeDb);
  await createIndexes(activeDb);
  return activeDb;
}

module.exports = {
  setupDatabase,
  assertEmpty,
  dropCollections,
  createCollectionsWithValidators,
  createIndexes,
  collectionSchemas,
};

// Ejecución standalone: `node src/db/setup.js` o `npm run setup` (agregar
// `-- --force` para saltar la guarda de datos existentes).
if (require.main === module) {
  const force = process.argv.includes('--force');
  setupDatabase(undefined, { force })
    .then(() => {
      console.log('Colecciones, validadores e índices creados en "recetario".');
      return close();
    })
    .catch(async (err) => {
      console.error('Error al inicializar la base:', err.message);
      process.exitCode = 1;
      await close();
    });
}
