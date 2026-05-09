const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // First try to get token from cookie
        let token = req.cookies ? req.cookies.auth_token : null;
        
        // If not in cookie, check Authorization header (Bearer token)
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            req.user = decoded;
        } else {
            req.user = null;
        }
    } catch (e) {
        // Token might be invalid or expired, just set user to null for optional routes
        req.user = null;
    }
    next();
};
