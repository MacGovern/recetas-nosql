const express = require('express');
const { crear, listar, obtenerPorId, actualizar, eliminar } = require('../controllers/recetas.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', requireAuth, crear);
router.get('/', listar);
router.get('/:id', obtenerPorId);
router.put('/:id', requireAuth, actualizar);
router.delete('/:id', requireAuth, eliminar);

module.exports = router;
