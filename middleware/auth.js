const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).send('Authorization token required');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'a');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send('Invalid or expired token');
    }
};

module.exports = authenticate;