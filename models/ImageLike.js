const Sequelize = require('sequelize');
const db = require('../config/database');

const ImageLike = db.define('image_like', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: Sequelize.UUID,
        allowNull: false
    },
    album_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'album_id']
        }
    ]
});

module.exports = ImageLike;
