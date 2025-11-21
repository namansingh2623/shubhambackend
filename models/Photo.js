const Sequelize = require('sequelize');
const db = require('../config/database');


const Photo  = db.define('photos', {
    // attributes
    imageUrl: {
        type: Sequelize.STRING,
        allowNull: false
    },
    storageId: {
        type: Sequelize.STRING,
        allowNull:false
    },
    albumId: {
        type:Sequelize.INTEGER,
        allowNull:true
    },
    like:{
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    share:{
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    imagedesc:{
        type: Sequelize.STRING,
        allowNull:true
    },
    // E-commerce fields (all optional for backward compatibility)
    premiumImageUrl: {
        type: Sequelize.STRING,
        allowNull: true
    },
    premiumStorageId: {
        type: Sequelize.STRING,
        allowNull: true
    },
    price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    isPremium: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }

});

module.exports = Photo;
