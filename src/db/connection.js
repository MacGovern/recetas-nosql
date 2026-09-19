const { MongoClient } = require('mongodb');
const { mongoUri, dbName } = require('../config/env');

let client;
let db;

async function connect() {
  if (db) return db;
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('DB no inicializada: llamar a connect() antes de usar getDb().');
  }
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}

module.exports = { connect, getDb, close };
