const express = require('express')
const router = express.Router();
const multer =require('multer')

const uuid=require('uuid')
const AnnouncementFile = require('../models/AnnouncementsFiles')
const Announcements= require('../models/Announcements');
const s3 = require(   '../config/s3');
const checkAuth = require('../middleware/check-auth');


const storage =multer.memoryStorage({
    destination:function(req,file,callback){
        callback(null,'')
    },
})
const upload= multer({storage,limits:{fileSize:5242880}}).single('image')
router.post('/upload',checkAuth,upload,(req,res,next)=>{
    let announcementId=req.query.announcementId;
    console.log("my id "+announcementId)
    if(!req.file)res.status(401).json({message:'Please include a file first!'})
    else{
        Announcements
            .findByPk(announcementId)
            .then(announcement=>{
                if(!announcement){
                    console.log("in if")
                    res.status(404).json({message:'Announcement Doesnt exist' })}
                else {
                    console.log("in else")
                    let myFile=req.file.originalname.split(".")
                    const params={
                        Bucket:'bbpsipbucket/AnnouncementFiles',
                        Key:announcementId+'___'+myFile+`${uuid.v4()}`,
                        Body: req.file.buffer,
                        ACL:'public-read'
                    };
                    s3.upload(params,(error,data)=>{
                        if(error){
                            console.log("in s3 if")
                            res.status(error.statusCode).json({message:"error from s3"+error.message})}
                        else {
                            console.log("in s3 else")
                            new AnnouncementFile({fileUrl: data.Location,storageId:data.Key,announcementId:announcement.id})
                                .save()
                                .then((myfile)=>{
                                    console.log("in then clause ")
                                    if(announcement.coverFile===''){
                                     announcement.update({coverFile: myfile.fileUrl})
                                            .then(()=>{
                                                res.json({message:'AnnouncementFiles Uploaded Successfully!'})
                                            }).catch(err=>next(err));
                                    }
                                    else {
                                        console.log("in s3 fail ")
                                        res.json({message:'AnnouncementFiles Was not Uploaded!'})
                                    }
                                })
                                .catch(err=>next("outside error"+err.message))
                        }
                    })
                }
            })
            .catch(err=>next(err))

    }});

router.delete('/delete/:announcementId',checkAuth,(req,res,next)=>{
    Announcements
        .findByPk(req.params.announcementId)
        .then(announcement=>{
            if(!announcement)res.status(400).json({message:'No such Announcement Exists'})
            else{
                console.log("this i smy storage id "+announcement.storageId)
                const params = {Bucket: 'bbpsipbucket', Key: announcement.storageId};
                s3.deleteObject(params, function(err, data) {
                    if(err){next(err)}
                    announcement
                        .destroy()
                        .then(()=>{res.json({message:'Photo was deleted!'+announcement.storageId})})
                        .catch(err=>next(err))
                });
            }
        })
        .catch(err=>next(err))
});

module.exports = router;