// routes/articles.js
const express = require('express');
const slugify = require('slugify');
const multer = require('multer');
const uuid = require('uuid');
const Article = require('../models/Article');
const ArticleSection = require('../models/ArticleSection');
const ArticleFigure = require('../models/ArticleFigure');
const auth = require('../middleware/check-auth');
const { mdToSafeHtml, estimateReadingTime } = require('../utils/markdown');
const s3 = require('../config/s3');

const router = express.Router();

// Multer configuration for cover image upload
const storage = multer.memoryStorage({
    destination: function(req, file, callback) {
        callback(null, '');
    },
});

const upload = multer({ storage, limits: { fileSize: 10485760 } }).single('coverImage'); // 10MB limit

// Create new article (draft)
router.post('/', auth, async (req, res, next) => {
    try {
        // Handle case where body is not parsed due to content-type issue
        let bodyData = req.body;
        if (req.rawBody && Object.keys(req.body).length === 0) {
            try {
                bodyData = JSON.parse(req.rawBody);
            } catch (e) {
                // Fallback to empty object if parsing fails
                bodyData = {};
            }
        }
        
        const { title, excerpt, coverImage, tags } = bodyData;
        if (!title) return res.status(400).json({ message: 'Title is required' });

        const slugBase = slugify(title, { lower: true, strict: true });
        let slug = slugBase;
        let i = 1;
        while (await Article.findOne({ where: { slug } })) {
            slug = `${slugBase}-${i++}`;
        }

        const article = await Article.create({
            title,
            slug,
            excerpt: excerpt || null,
            coverImage: coverImage || null,
            status: 'draft',
            author: req.userData.name || req.userData.email, // adjust
        });

        // optional: attach tags if passed
        if (Array.isArray(tags)) {
            const Tag = require('../models/Tag');
            const ArticleTag = require('../models/ArticleTag');
            const tagRows = await Promise.all(
                tags.map((name) =>
                    Tag.findOrCreate({ where: { name } }).then(([tag]) => tag)
                )
            );
            await article.setTags(tagRows);
        }

        res.status(201).json({ article });
    } catch (e) {
        next(e);
    }
});

// Update sections + figures
router.put('/:id/sections', auth, async (req, res, next) => {
    try {
        const article = await Article.findByPk(req.params.id);
        if (!article) return res.status(404).json({ message: 'Not found' });

        let { sections } = req.body; // array of section + figures
        
        // Handle case where req.body is empty but rawBody contains data
        if (sections === undefined && req.rawBody) {
            try {
                const parsedBody = JSON.parse(req.rawBody);
                sections = parsedBody.sections;
                console.log('Parsed sections from rawBody:', sections);
            } catch (parseError) {
                console.error('Error parsing rawBody for sections:', parseError);
            }
        }
        
        console.log(`Saving sections for article ${req.params.id}:`, sections);

        // Handle case where sections is undefined or not an array
        if (!sections || !Array.isArray(sections)) {
            console.log('No sections to update');
            return res.json({ success: true, message: 'No sections to update' });
        }

        let totalWords = 0;

        for (const s of sections) {
            let safeHtml;
            try {
                safeHtml = mdToSafeHtml(s.bodyMarkdown || '');
                const words = (s.bodyMarkdown || '').trim().split(/\s+/).length;
                totalWords += words;
            } catch (error) {
                console.error('Error processing markdown:', error);
                safeHtml = s.bodyMarkdown || ''; // fallback to raw text
            }

            let section;
            if (s.id) {
                console.log(`Updating existing section ${s.id}`);
                section = await ArticleSection.findByPk(s.id);
                if (!section) {
                    console.log(`Section ${s.id} not found, skipping`);
                    continue;
                }
                await section.update({
                    order: s.order,
                    title: s.title,
                    bodyMarkdown: s.bodyMarkdown,
                    bodyHtml: safeHtml,
                });
                console.log(`Updated section ${s.id}`);
            } else {
                console.log(`Creating new section for article ${article.id}`);
                section = await ArticleSection.create({
                    articleId: article.id,
                    order: s.order,
                    title: s.title,
                    bodyMarkdown: s.bodyMarkdown,
                    bodyHtml: safeHtml,
                });
                console.log(`Created section ${section.id}`);
            }

            if (Array.isArray(s.figures)) {
                for (const f of s.figures) {
                    if (f.id) {
                        const fig = await ArticleFigure.findByPk(f.id);
                        if (fig) {
                            await fig.update({
                                sectionId: section.id,
                                order: f.order,
                                imageUrl: f.imageUrl,
                                caption: f.caption || null,
                                altText: f.altText || null,
                            });
                        }
                    } else {
                        await ArticleFigure.create({
                            sectionId: section.id,
                            order: f.order,
                            imageUrl: f.imageUrl,
                            caption: f.caption || null,
                            altText: f.altText || null,
                        });
                    }
                }
            }
        }

        // update readingTime
        const rt = estimateReadingTime(Array(totalWords).fill('word').join(' '));
        await article.update({ readingTime: rt });

        console.log(`Successfully saved ${sections.length} sections for article ${req.params.id}`);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// Publish / unpublish
router.post('/:id/publish', auth, async (req, res, next) => {
    try {
        let { publish } = req.body;
        
        // Handle case where req.body is empty but rawBody contains data
        if (publish === undefined && req.rawBody) {
            try {
                const parsedBody = JSON.parse(req.rawBody);
                publish = parsedBody.publish;
                console.log('Parsed publish from rawBody:', publish);
            } catch (parseError) {
                console.error('Error parsing rawBody:', parseError);
            }
        }
        
        console.log(`Publishing article ${req.params.id}, publish: ${publish}`);
        const article = await Article.findByPk(req.params.id);
        if (!article) return res.status(404).json({ message: 'Not found' });
        
        const newStatus = publish ? 'published' : 'draft';
        console.log(`Updating article ${req.params.id} to status: ${newStatus}`);
        
        await article.update({
            status: newStatus,
            publishedAt: publish ? (article.publishedAt || new Date()) : null,
        });
        
        // Reload the article to get the updated values
        await article.reload();
        console.log(`Article ${req.params.id} updated successfully. New status: ${article.status}`);
        res.json({ article });
    } catch (e) {
        console.error('Error in publish endpoint:', e);
        next(e);
    }
});

// Admin list drafts
router.get('/drafts', auth, async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const pageSize = Math.max(parseInt(req.query.pageSize) || 10, 1);
        const { count, rows } = await Article.findAndCountAll({
            where: { status: 'draft' },
            limit: pageSize,
            offset: (page - 1) * pageSize,
            order: [['updatedAt', 'DESC']],
            attributes: ['id', 'title', 'slug', 'excerpt', 'coverImage', 'status', 'publishedAt', 'readingTime', 'createdAt', 'updatedAt'],
        });
        res.json({ page, pageSize, totalItems: count, articles: rows });
    } catch (e) {
        next(e);
    }
});

// Public list
router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const pageSize = Math.max(parseInt(req.query.pageSize) || 10, 1);
        const { count, rows } = await Article.findAndCountAll({
            where: { status: 'published' },
            limit: pageSize,
            offset: (page - 1) * pageSize,
            order: [['publishedAt', 'DESC']],
            attributes: ['id', 'title', 'slug', 'excerpt', 'coverImage', 'status', 'readingTime', 'publishedAt'],
        });
        res.json({ page, pageSize, totalItems: count, articles: rows });
    } catch (e) {
        next(e);
    }
});

// Admin fetch by ID (includes drafts)
router.get('/admin/:id', auth, async (req, res, next) => {
    try {
        const article = await Article.findByPk(req.params.id, {
            include: [
                { model: ArticleSection, as: 'sections', include: [{ model: ArticleFigure, as: 'figures' }] },
            ],
            order: [
                ['sections', 'order', 'ASC'],
                ['sections', 'figures', 'order', 'ASC']
            ],
        });
        if (!article) return res.status(404).json({ message: 'Article not found' });
        res.json({ article });
    } catch (e) {
        next(e);
    }
});

// Upload cover image
router.post('/upload-cover', auth, upload, (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please include a file first!' });
    }

    try {
        // Generate unique key for S3
        const fileExtension = req.file.originalname.split('.').pop();
        const params = {
            Bucket: process.env.S3_BUCKET_NAME + '/Articles',
            Key: `cover-${uuid.v4()}.${fileExtension}`,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };

        s3.upload(params, (error, data) => {
            if (error) {
                console.error('S3 upload error:', error);
                return res.status(error.statusCode || 500).json({ message: error.message });
            }

            console.log('Cover image uploaded successfully:', data.Location);
            res.json({
                message: 'Cover image uploaded successfully!',
                coverImageUrl: data.Location,
            });
        });
    } catch (err) {
        console.error('Error uploading cover image:', err);
        next(err);
    }
});

// Public fetch by slug
router.get('/:slug', async (req, res, next) => {
    try {
        const article = await Article.findOne({
            where: { slug: req.params.slug, status: 'published' },
            include: [
                { model: ArticleSection, as: 'sections', include: [{ model: ArticleFigure, as: 'figures' }] },
            ],
            order: [
                ['sections', 'order', 'ASC'],
                ['sections', 'figures', 'order', 'ASC']
            ],
        });
        if (!article) return res.status(404).json({ message: 'Not found' });
        res.json({ article });
    } catch (e) {
        next(e);
    }
});

module.exports = router;