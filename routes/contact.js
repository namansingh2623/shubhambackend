const express = require('express');
const router = express.Router();
const { Message } = require('../models');
const Sequelize = require('sequelize');

// POST /api/contact - Create a new message
router.post('/', async (req, res) => {
    try {
        const { email, message } = req.body;

        if (!email || !message) {
            return res.status(400).json({ error: 'Email and message are required' });
        }

        // 1. Rate Limiting: Check if this email sent a message in the last 5 minutes
        const fiveMinutesAgo = new Date(new Date() - 5 * 60 * 1000);
        const recentMessage = await Message.findOne({
            where: {
                email: email,
                createdAt: {
                    [Sequelize.Op.gte]: fiveMinutesAgo
                }
            }
        });

        if (recentMessage) {
            return res.status(429).json({ error: 'You are sending messages too quickly. Please wait 5 minutes.' });
        }

        // 2. Duplicate Check: Check if identical message exists from this email (prevent spam loops)
        const duplicateMessage = await Message.findOne({
            where: {
                email: email,
                message: message
            }
        });

        if (duplicateMessage) {
            return res.status(409).json({ error: 'You have already sent this message.' });
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
