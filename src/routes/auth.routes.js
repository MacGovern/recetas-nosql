const express = require('express');
const { registrar, login, logout, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', registrar);
router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/me', me);

module.exports = router;
