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
    }

});

module.exports = Photo;
