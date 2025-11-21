const express = require('express')
const router = express.Router();

const Album = require('../models/Album');
const Photo = require('../models/Photo');
const s3 = require('../config/s3');
const checkAuth = require('../middleware/check-auth');

//create album
router.post('/create', checkAuth,(req,res,next)=>{
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);
    console.log("Headers:", req.headers);
    console.log("Content-Type:", req.get('Content-Type'));
    
    let { title, description, uploadedBy, category } = req.body;
    
    // Handle case where req.body is empty but rawBody contains data
    if ((!title || !description || !uploadedBy || !category) && req.rawBody) {
        try {
            const parsedBody = JSON.parse(req.rawBody);
            title = parsedBody.title;
            description = parsedBody.description;
            uploadedBy = parsedBody.uploadedBy;
            category = parsedBody.category;
            console.log('Parsed album data from rawBody:', { title, description, uploadedBy, category });
        } catch (parseError) {
            console.error('Error parsing rawBody for album:', parseError);
        }
    }
    
    console.log("Final extracted fields:", { title, description, uploadedBy, category });
    
    if (!title || !description || !uploadedBy || !category) {
        console.log("Validation failed - missing fields");
        return res.status(400).json({
            message: 'Missing required fields. Please provide: title, description, uploadedBy, category'
        });
    }
    
    new Album({
        title: title,
        description: description,
        coverImage: '', // Will be set later when images are uploaded
        uploadedBy: uploadedBy,
        category: category,
    })
        .save()
        .then((album)=>{
            if(!album) {
                return res.status(400).json({message:'Failed to create album'});
            }
            res.status(201).json({
                message:'Album Successfully Created!',
                album: album.id
            });
        })
        .catch(err=>{
            console.error('Album creation error:', err);
            next(err);
        });
});

router.delete('/delete/:albumId', checkAuth, async (req, res, next) => {
    try {
        const photos = await Photo.findAll({ where: { albumId: req.params.albumId } });

        // Delete all photos from S3 and DB
        const deletePromises = photos.map(async (photo) => {
            const params = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: photo.storageId
            };
            console.log(`Attempting to delete S3 object: Bucket=${params.Bucket}, Key=${params.Key}`);

            try {
                // Wait for deletion from S3
                await s3.deleteObject(params).promise();
                console.log(`✅ Successfully deleted photo from S3: ${params.Key}`);
            } catch (deleteErr) {
                console.error(`❌ Failed to delete photo ${params.Key} from S3:`, deleteErr.message);
                console.error('Error details:', JSON.stringify(deleteErr, null, 2));
                // Check if it's a permissions error
                if (deleteErr.code === 'AccessDenied' || deleteErr.statusCode === 403) {
                    console.error('⚠️  IAM permission issue: Your IAM user needs s3:DeleteObject permission');
                }
                // Continue with DB deletion even if S3 delete fails
            }

            // Delete from DB
            await photo.destroy();
        });

        // Wait for all deletions to complete
        await Promise.all(deletePromises);

        // Now delete the album
        const status = await Album.destroy({ where: { id: req.params.albumId } });

        if (status) {
            res.status(202).json({ message: 'Album Successfully deleted!' });
        } else {
            res.status(404).json({ message: 'Resource not found' });
        }
    } catch (err) {
        next(err);
    }
});

router.get('/all', async (req, res, next) => {
    try {
        // parse with safe defaults (1-based page index)
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const pageSize = Math.max(parseInt(req.query.pageSize, 10) || 10, 1);

        const limit = pageSize;
        const offset = (page - 1) * pageSize;

        const { count, rows } = await Album.findAndCountAll({
            limit,
            offset,
            order: [['createdAt', 'DESC']], // optional but helpful for UX
        });

        res.json({
            page,
            pageSize,          // ✅ echo the requested pageSize, not rows.length
            totalItems: count, // ✅ total available, ignoring pagination
            albums: rows,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', (req,res,next)=>{
    Album
        .findByPk(req.params.id, {
            include: [{
                model: Photo
            }]
        })
        .then(album=>{
            if(album){
                // Sequelize returns photos in a Photos array (capitalized, pluralized)
                // Convert to lowercase 'photos' for frontend compatibility
                const albumData = album.toJSON();
                if (albumData.Photos) {
                    albumData.photos = albumData.Photos;
                    delete albumData.Photos;
                }
                res.json(albumData);
            } else {
                res.status(404).json({message:'No album found with given id'});
            }
        })
        .catch(err=>{
            console.error('Error fetching album:', err);
            next(err);
        })
});

router.patch('/setCoverImage/:albumId',checkAuth,(req,res,next)=>{
    Album.update(
        { coverImage: req.body.coverImage },
        { where: { id: req.params.albumId } })
        .then((result)=>{
            (result===1)?res.status(200).json('Cover Image set successfully'):
                res.status(404).json('Album with given id was not found')
        })
        .catch(err =>next(err))
})
router.patch('/likes/:albumId', (req, res, next) => {
    // Removed checkAuth to allow likes without login
    Album.findByPk(req.params.albumId)
        .then(album => {
            if (!album) return res.status(404).json({ message: 'Album not found' });
            return album.increment('like', { by: 1 }).then(() => {
                return album.reload();  // reload updated values from DB
            }).then(updatedAlbum => {
                res.json({ likes: updatedAlbum.like });
            });
        })
        .catch(err => next(err));
})

router.patch('/shares/:albumId',checkAuth,(req,res,next)=>{
    Album.update(
        {share:req.params.like},
        {where:{id:req.params.albumId}})
        .then((result)=>{
                (result===1)?res.status(200).json('Shared the Album successfully'):
                    res.status(404).json('Shared the Album failed with given Id')
            }
        ).
    catch(err =>next(err))
})


module.exports = router;

