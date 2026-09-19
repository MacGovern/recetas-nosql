const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { mongoUri, dbName, sessionSecret } = require('../config/env');

if (!sessionSecret) {
  throw new Error('Falta SESSION_SECRET en el entorno: definila en .env antes de iniciar el servidor.');
}

const store = MongoStore.create({
  mongoUrl: mongoUri,
  dbName,
  collectionName: 'sessions',
  ttl: 60 * 60 * 24,
});

module.exports = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  },
});
