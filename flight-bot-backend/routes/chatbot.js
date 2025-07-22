const express = require('express');
const router = express.Router();

const { handleUserMessage } = require('../controllers/chatbotController.js');

// POST /api/chat
router.post('/', handleUserMessage);

module.exports = router;
