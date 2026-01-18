const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// POST /api/contact - Create a new message
router.post('/', async (req, res) => {
    try {
        const { email, message } = req.body;

        if (!email || !message) {
            return res.status(400).json({ error: 'Email and message are required' });
        }

        const newMessage = await Message.create({
            email,
            message
        });

        res.status(201).json(newMessage);
    } catch (err) {
        console.error('Error saving message:', err);
        // Handle validation errors specifically
        if (err.name === 'SequelizeValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/contact - Get all messages (sorted by date)
router.get('/', async (req, res) => {
    try {
        const messages = await Message.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
