const express = require('express');
const {
  listarUsuarios,
  cambiarRol,
  crearAdministrador,
  crearCategoria,
  renombrarCategoria,
  eliminarCategoria,
  listarModeraciones,
} = require('../controllers/admin.controller');
const { requireRolVigente } = require('../middleware/auth.middleware');

const router = express.Router();

// Todo el router es solo para admin, con el rol leído de la base en cada
// pedido. El admin es una cuenta de plataforma: no hereda de Usuario ni de
// Moderador, y el moderador no entra acá.
router.use(requireRolVigente('admin'));

router.get('/usuarios', listarUsuarios);
router.put('/usuarios/:id/rol', cambiarRol);
router.post('/administradores', crearAdministrador);

router.post('/categorias', crearCategoria);
router.put('/categorias/:id', renombrarCategoria);
router.delete('/categorias/:id', eliminarCategoria);

router.get('/moderaciones', listarModeraciones);

module.exports = router;
