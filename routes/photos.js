const express = require('express')
const router = express.Router();
const multer =require('multer')

const uuid=require('uuid')
const Photo = require('../models/Photo')
const Album  = require('../models/Album');
const s3 = require(   '../config/s3');
const checkAuth = require('../middleware/check-auth');
const { convertToWebP, isWebP } = require('../utils/imageConverter');


const storage =multer.memoryStorage({
    destination:function(req,file,callback){
        callback(null,'')
    },
})

const upload= multer({storage,limits:{fileSize:54288000}}).single('image')

router.post('/upload',checkAuth,upload,async (req,res,next)=>{
    let albumId = req.query.albumId;
    if(!req.file)res.status(401).json({message:'Please include a file first!'})
    else{
        Album
            .findByPk(albumId)
            .then(async album=>{
                console.log("Album id found!!",albumId)
                if(!album){res.status(404).json({message:'Album doesnt exist'})}
                else{
                    try {
                        // Convert image to WebP format
                        let imageBuffer = req.file.buffer;
                        let contentType = 'image/webp';
                        
                        // Check if already WebP, if not convert
                        const alreadyWebP = await isWebP(imageBuffer);
                        if (!alreadyWebP) {
                            console.log('Converting photo to WebP...');
                            imageBuffer = await convertToWebP(imageBuffer, { 
                                quality: 85,
                                maxWidth: 1920, // Max width for photos
                                maxHeight: 1920 // Max height for photos
                            });
                            console.log('Photo converted to WebP successfully');
                        } else {
                            console.log('Photo is already in WebP format');
                        }

                        // Generate unique key for S3 (always use .webp extension)
                        const params={
                            Bucket:process.env.S3_BUCKET_NAME+'/Gallery',
                            Key: `${uuid.v4()}.webp`,
                            Body: imageBuffer,
                            ContentType: contentType,
                            // ACL removed - bucket policy handles public access
                        };

                        s3.upload(params,(error,data)=>{
                            if(error){res.status(error.statusCode).json({message:error.message})}
                            else{
                                console.log("Photo uploaded successfully as WebP!!")
                                const imageDescription = req.body.imagedesc || '';
                                new Photo({
                                    imageUrl: data.Location,
                                    storageId: data.Key,
                                    albumId: album.id,
                                    imagedesc: imageDescription
                                }).save()
                                    .then((photo)=>{
                                        console.log("Arjun logs, photo added in db ")


                                        if(album.coverImage===''){
                                            album.update({coverImage:photo.imageUrl})
                                                .then(()=> {
                                                res.json({message:'Photo Uploaded Successfully!',photoId:photo.id})
                                            }).catch(err=>{
                                                console.log(err);
                                                next(err);
                                            });
                                        }
                                        else  res.json({message:'Photo Uploaded Successfully!',photoId:photo.id})


                                    })
                                    .catch(err=>{
                                        console.log({err})
                                        next(err.message)
                                    })
                            }
                        })
                    } catch (conversionError) {
                        console.error('Error converting photo to WebP:', conversionError);
                        next(conversionError);
                    }
                }

            })
            .catch(err=>next(err))
    }

})

router.delete('/delete/:photoId',checkAuth,(req,res,next)=>{

    Photo
        .findByPk(req.params.photoId)
        .then(photo=>{
            if(!photo)res.status(400).json({message:'No such Photo Exists'})
            else{
                const params = {Bucket: process.env.S3_BUCKET_NAME, Key: photo.storageId};
                s3.deleteObject(params, function(err, data) {
                    if(err){next(err)}
                    else photo
                        .destroy()
                        .then(()=>{res.json({message:'Photo was deleted!',data:data})})
                        .catch(err=>next(err))
                });
            }

        })
        .catch(err=>next(err))



});

router.patch('/likes/:photoId', (req, res, next) => {
    Photo.findByPk(req.params.photoId)
        .then(photo => {
            if (!photo) return res.status(404).json({ message: 'Photo not found' });
            return photo.increment('like', { by: 1 }).then(() => {
                return photo.reload();  // reload updated values from DB
            }).then(updatedPhoto => {
                res.json({ likes: updatedPhoto.like });
            });
        })
        .catch(err => next(err));
});
router.patch('/shares/:photoId', (req, res, next) => {
    Photo.findByPk(req.params.photoId)
        .then(photo => {
            if (!photo) return res.status(404).json({ message: 'Photo not found' });
            return photo.increment('share', { by: 1 }).then(() => {
                return photo.reload();
            }).then(updatedPhoto => {
                res.json({ shares: updatedPhoto.share });
            });
        })
        .catch(err => next(err));
});

// router.patch('/likes/:photoId',checkAuth,(req,res,next)=>{
//     Photo.update(
//         {like:req.params.like},
//         {where:{id:req.params.albumId}})
//         .then((result)=>{
//                 (result===1)?res.status(200).json('Liked the Photo successfully'):
//                     res.status(404).json('Liked the Photo failed with given Id')
//             }
//         ).
//     catch(err =>next(err))
// })
// router.patch('/shares/:photoId',checkAuth,(req,res,next)=>{
//     Photo.update(
//         {share:req.params.like},
//         {where:{id:req.params.photoId}})
//         .then((result)=>{
//                 (result===1)?res.status(200).json('Shared the Photo successfully'):
//                     res.status(404).json('Shared the Photo failed with given Id')
//             }
//         ).
//     catch(err =>next(err))
// })


module.exports = router;
