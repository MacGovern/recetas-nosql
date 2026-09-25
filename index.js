const express = require('express');
const path = require('path');
const { connect, getDb, close } = require('./src/db/connection');
const { port } = require('./src/config/env');
const sessionMiddleware = require('./src/middleware/session.middleware');
const authRoutes = require('./src/routes/auth.routes');
const recetasRoutes = require('./src/routes/recetas.routes');
const opinionesRoutes = require('./src/routes/opiniones.routes');
const usuariosRoutes = require('./src/routes/usuarios.routes');
const consultasRoutes = require('./src/routes/consultas.routes');
const categoriasRoutes = require('./src/routes/categorias.routes');

const app = express();

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'src/public'))); // vacío hasta la Etapa 6

app.use('/api/auth', authRoutes);
app.use('/api/recetas', recetasRoutes);
app.use('/api/opiniones', opinionesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/consultas', consultasRoutes);
app.use('/api/categorias', categoriasRoutes);

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
