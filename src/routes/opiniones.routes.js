const express = require('express');
const { crear, listar, actualizar, eliminar } = require('../controllers/opiniones.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', requireAuth, crear);
router.get('/', listar);
router.put('/:id', requireAuth, actualizar);
router.delete('/:id', requireAuth, eliminar);

module.exports = router;
