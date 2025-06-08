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
        allowNull:true
    },
    share:{
        type: Sequelize.INTEGER,
        allowNull:true
    },
    imagedesc:{
        type: Sequelize.STRING,
        allowNull:true
    }

});

module.exports = Photo;
