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
    new Album({
        title:req.body.title,
        description: req.body.description,
        coverImage:'',
        uploadedBy: req.body.uploadedBy,
        category:req.body.category,

    })
        .save()
        .then((album)=>{
            if(!album)res.status(400).json({message:'Invalid input'});
            res.status(201).json({message:'Album Successfully Created!',album:album.id})})
        .catch(err=>{next(err)})
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
            console.log(`Attempting to delete S3 object: Bucket=${params.Bucket}, "Checking Key ",Key=${params.Key}`);
            console.log("Photo key", photo.storageId, "-->");

            // Wait for deletion from S3
            await s3.deleteObject(params).promise();

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
        .findByPk(req.params.id,{include:'photos'})
        .then(album=>{(album)?res.json(album):res.status(404).json({message:'No album found with given id'})})
        .catch(err=>next(err))
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
router.patch('/likes/:albumId',checkAuth,(req,res,next)=>{
    Album.update(
        {like:req.params.like},
        {where:{id:req.params.albumId}})
        .then((result)=>{
            (result===1)?res.status(200).json('Liked the Album successfully'):
                res.status(404).json('Liked the Album failed with given Id')
        }
    ).
        catch(err =>next(err))
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

