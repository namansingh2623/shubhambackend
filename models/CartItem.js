const Sequelize = require('sequelize');
const db = require('../config/database');

const CartItem = db.define('cart_items', {
    cartId: {
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
    }
});

module.exports = CartItem;

