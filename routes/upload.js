// routes/upload.js
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const auth = require('../middleware/check-auth');

const router = express.Router();
const s3 = new S3Client({ region: process.env.AWS_REGION });

router.post('/presign', auth, async (req, res, next) => {
    try {
        const { fileName, contentType } = req.body;
        const key = `articles/${Date.now()}-${fileName}`;
        const cmd = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            ContentType: contentType,
            ACL: 'public-read',
        });
        const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
        const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        res.json({ url, publicUrl, key });
    } catch (e) {
        next(e);
    }
});

module.exports = router;