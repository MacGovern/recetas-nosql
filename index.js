const express = require('express');
const path = require('path');
const { connect, getDb, close } = require('./src/db/connection');
const { port } = require('./src/config/env');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/public'))); // vacío hasta la Etapa 6

app.get('/api/health', async (req, res) => {
  try {
    await getDb().command({ ping: 1 });
    res.json({ ok: true, db: getDb().databaseName });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function start() {
  await connect();
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
}

process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
