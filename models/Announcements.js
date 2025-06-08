const Sequilize= require('sequelize')
const db=require('../config/database')

const Announcements=db.define('announcement',{
    title:{
        type:Sequilize.STRING,
        nullable:false,
    },
    announcementDate:{
        type: Sequilize.DATEONLY,
        nullable: false
    },
    description:{
        type: Sequilize.TEXT,
        nullable:false
    },
        announcementType:{
        // 1 for principal message
        type:Sequilize.INTEGER,
        nullable:false,
    },
    coverFile:{
        type:Sequilize.STRING,
        allowNull:false
    },
    myFile:{
        type:Sequilize.STRING,
        allowNull: true
    }

});
module.exports=Announcements;


