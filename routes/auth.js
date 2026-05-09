const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const AppUser = require('../models/AppUser');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res, next) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ error: { message: 'No credential provided' } });
        }

        // Verify the Google JWT token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, sub: google_id } = payload;

        // Check if user exists, if not create
        let user = await AppUser.findOne({ where: { google_id } });
        
        if (!user) {
            user = await AppUser.create({
                google_id,
                email,
                name
            });
        }

        // Issue our own JWT session token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'app_user', subscription_status: user.subscription_status },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        // Set HttpOnly cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            message: 'Authentication successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                subscription_status: user.subscription_status
            },
            token
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        next(error);
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
