const Sequelize = require('sequelize');
const db = require('../config/database');

const OrderItem = db.define('order_items', {
    orderId: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    photoId: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    downloaded: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    downloadExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true  // Optional: limit download window
    }
});

module.exports = OrderItem;

