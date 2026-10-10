const express = require('express');
const { eliminarReceta, eliminarOpinion } = require('../controllers/moderacion.controller');
const { requireRolVigente } = require('../middleware/auth.middleware');

const router = express.Router();

// Solo moderador, con el rol leído de la base en cada pedido. El admin no
// hereda de Usuario ni de Moderador: no entra acá.
router.delete('/recetas/:id', requireRolVigente('moderador'), eliminarReceta);
router.delete('/opiniones/:id', requireRolVigente('moderador'), eliminarOpinion);

module.exports = router;
