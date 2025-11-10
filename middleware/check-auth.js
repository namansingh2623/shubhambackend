const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        // Debug logging
        if (!authHeader) {
            console.log('❌ No Authorization header found');
            console.log('Request headers:', JSON.stringify(req.headers, null, 2));
            return res.status(401).json({ message: 'Authentication failed: No token provided' });
        }
        
        // Verify token
        const decoded = jwt.verify(authHeader, process.env.JWT_SECRET);
        req.userData = decoded;
        next();
    } catch (e) {
        console.error('❌ JWT verification failed:', e.message);
        console.log('Token received:', req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none');
        return res.status(401).json({ message: 'Authentication failed: ' + e.message });
    }
}
