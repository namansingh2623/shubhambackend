const Sequelize = require('sequelize');
const db = require('../config/database');

const Cart = db.define('carts', {
    sessionId: {
        type: Sequelize.STRING,
        allowNull: false  // For guest users
    },
    userId: {
        type: Sequelize.INTEGER,
        allowNull: true  // For logged-in users (optional)
    },
    expiresAt: {
        type: Sequelize.DATE,
        allowNull: true  // Optional: cart expiration
    }
});

module.exports = Cart;

