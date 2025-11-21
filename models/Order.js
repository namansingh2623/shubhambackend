const Sequelize = require('sequelize');
const db = require('../config/database');

const Order = db.define('orders', {
    // User identification (can be userId or email for guest checkout)
    userId: {
        type: Sequelize.INTEGER,
        allowNull: true  // Allow null for guest checkout
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false  // Required for order tracking
    },
    totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
    },
    paymentIntentId: {
        type: Sequelize.STRING,
        allowNull: true  // Stripe/PayPal payment ID
    },
    paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true  // 'stripe', 'paypal', etc.
    },
    createdAt: {
        type: Sequelize.DATE,
        allowNull: false
    },
    updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
    }
});

module.exports = Order;

