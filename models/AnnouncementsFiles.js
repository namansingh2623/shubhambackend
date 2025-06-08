const Sequlize=require('sequelize')
const db=require('../config/database')

const AnnouncementFile=db.define('announcementFile',{
    //attributes
    storageId:{
        type:Sequlize.STRING,
        nullable:false
    },
    fileUrl:{
        type: Sequlize.STRING,
        nullable: false
    },
    announcementId:{
        type:Sequlize.INTEGER,
        nullable:true
    }

});
module.exports=AnnouncementFile