const express = require('express');
const { agregarFavorito, quitarFavorito, listarFavoritos } = require('../controllers/usuarios.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/favoritos', requireAuth, listarFavoritos);
router.post('/favoritos/:recetaId', requireAuth, agregarFavorito);
router.delete('/favoritos/:recetaId', requireAuth, quitarFavorito);

module.exports = router;
