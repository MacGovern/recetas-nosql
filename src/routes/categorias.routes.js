const express = require('express');
const { listar } = require('../controllers/categorias.controller');

const router = express.Router();

router.get('/', listar);

module.exports = router;
