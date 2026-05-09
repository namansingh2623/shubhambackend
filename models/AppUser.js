const Sequelize = require('sequelize');
const db = require('../config/database');

const AppUser = db.define('app_user', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    google_id: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    name: {
        type: Sequelize.STRING,
        allowNull: true
    },
    subscription_status: {
        type: Sequelize.ENUM('FREE', 'ACTIVE', 'CANCELLED'),
        defaultValue: 'FREE'
    },
    stripe_customer_id: {
        type: Sequelize.STRING,
        allowNull: true
    }
});

module.exports = AppUser;
