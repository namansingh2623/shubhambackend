const express =require('express');
const router = express.Router();

const Announcement=require('../models/Announcements');
// const AnnouncementFile=require('../models/AnnouncementsFiles');
const s3=require('../config/s3');
const checkAuth = require('../middleware/check-auth');

//create album
router.post('/NewAnnouncement', checkAuth,(req,res,next)=>{
    new Announcement({
        title:req.body.title,
        announcementDate: req.body.announcementDate,
        description: req.body.description,
        announcementType:req.body.announcementType,
        coverFile:'',
        myFile: req.body.myFile,
    })
        .save()
        .then((announcement)=>{
            console.log("in create")
            if(!announcement)res.status(400).json({message:'Invalid input'});
            res.status(201).json({message:'announcement Successfully Created!',announcement:announcement.id})})
        .catch(err=>{next(err)})
});


// All announcements
router.get('/all', (req,res,next)=>{
    const pageSize= parseInt(req.query.pageSize) ;
    const page = parseInt(req.query.page) ;
    Announcement
        .findAndCountAll({limit:pageSize || 10   ,offset:(page-1)*pageSize || 0})
        .then((announcements)=>
            res.json({page:page,pageSize:announcements.rows.length,totalItems:announcements.count,Announcements:announcements.rows}))
        .catch(err=>next(err))
});

router.delete('/deleteAnnouncement/:announcementId',checkAuth,(req,res,next)=>{
    Announcement.destroy({where:{id:req.params.announcementId}}).then(status=>{
        (status)?res.status(202).json({message:'Announcement Successfully deleted!'})
            :res.status(404).json({message:'Resource not found'})
    }).catch(err=>next(err))
    // AnnouncementFile.findAll({where:{announcementId:req.params.announcementId}}).then(photos=>{
    //     photos.map(photo=>{
    //         const params = {Bucket: 'bbpsipbucket', Key: AnnouncementFile.announcementId};
    //         console.log("Photo key ",AnnouncementFile.announcementId,"-->")
    //         s3.deleteObject(params, (err, data)=>{
    //             if(err) next(err)
    //             else photo.destroy();
    //
    //         });
    //     })
    // }).catch(err=>next(err));

})
module.exports = router;
