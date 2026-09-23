const express = require('express');
const { buscarRecetas } = require('../consultas/01-buscar-recetas');
const { recetaConOpiniones } = require('../consultas/02-receta-con-opiniones');
const { favoritosDelUsuario } = require('../consultas/03-favoritos-usuario');
const { rankingPorCategoria } = require('../consultas/04-ranking-por-categoria');
const { ingredientesPopulares } = require('../consultas/05-ingredientes-populares');
const { recetasCocinables } = require('../consultas/06-recetas-cocinables');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/buscar', buscarRecetas);
router.get('/recetas/:id/con-opiniones', recetaConOpiniones);
router.get('/favoritos', requireAuth, favoritosDelUsuario);
router.get('/ranking-categorias', rankingPorCategoria);
router.get('/ingredientes-populares', ingredientesPopulares);
router.get('/cocinables', recetasCocinables);

module.exports = router;
