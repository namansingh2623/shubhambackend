const Sequelize = require('sequelize');
const db = require('../config/database');

const Message = db.define('messages', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
            isEmail: true,
            notEmpty: true
        }
    },
    message: {
        type: Sequelize.TEXT, // Use TEXT for longer messages
        allowNull: false,
        validate: {
            notEmpty: true
        }
    }
});

module.exports = Message;
