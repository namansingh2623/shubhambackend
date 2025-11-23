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
const { convertToWebP, isWebP } = require('../utils/imageConverter');

const router = express.Router();

// Multer configuration for cover image upload
const storage = multer.memoryStorage({
    destination: function(req, file, callback) {
        callback(null, '');
    },
});

const upload = multer({ storage, limits: { fileSize: 2097152 } }).single('coverImage'); // 2MB limit
const uploadFigure = multer({ storage, limits: { fileSize: 2097152 } }).single('figureImage'); // 2MB limit

// Upload cover image (must be before /:slug route)
router.post('/upload-cover', auth, upload, async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please include a file first!' });
    }

    try {
        // Convert image to WebP format
        let imageBuffer = req.file.buffer;
        let contentType = 'image/webp';
        
        // Check if already WebP, if not convert
        const alreadyWebP = await isWebP(imageBuffer);
        if (!alreadyWebP) {
            console.log('Converting cover image to WebP...');
            imageBuffer = await convertToWebP(imageBuffer, { 
                quality: 85,
                maxWidth: 1920, // Max width for cover images
                maxHeight: 1080 // Max height for cover images
            });
            console.log('Cover image converted to WebP successfully');
        } else {
            console.log('Cover image is already in WebP format');
        }

        // Generate unique key for S3 (always use .webp extension)
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `Articles/cover-${uuid.v4()}.webp`,
            Body: imageBuffer,
            ContentType: contentType,
            // ACL removed - bucket policy handles public access
        };

        s3.upload(params, (error, data) => {
            if (error) {
                console.error('S3 upload error:', error);
                return res.status(error.statusCode || 500).json({ message: error.message });
            }

            console.log('Cover image uploaded successfully as WebP:', data.Location);
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

// Upload figure image (must be before /:slug route)
router.post('/upload-figure', auth, uploadFigure, async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please include a file first!' });
    }

    try {
        // Convert image to WebP format
        let imageBuffer = req.file.buffer;
        let contentType = 'image/webp';
        
        // Check if already WebP, if not convert
        const alreadyWebP = await isWebP(imageBuffer);
        if (!alreadyWebP) {
            console.log('Converting figure image to WebP...');
            imageBuffer = await convertToWebP(imageBuffer, { 
                quality: 85,
                maxWidth: 1600, // Max width for figure images
                maxHeight: 1200 // Max height for figure images
            });
            console.log('Figure image converted to WebP successfully');
        } else {
            console.log('Figure image is already in WebP format');
        }

        // Generate unique key for S3 (always use .webp extension)
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `Articles/figure-${uuid.v4()}.webp`,
            Body: imageBuffer,
            ContentType: contentType,
            // ACL removed - bucket policy handles public access
        };

        s3.upload(params, (error, data) => {
            if (error) {
                console.error('S3 upload error:', error);
                return res.status(error.statusCode || 500).json({ message: error.message });
            }

            console.log('Figure image uploaded successfully as WebP:', data.Location);
            res.json({
                message: 'Figure image uploaded successfully!',
                imageUrl: data.Location,
            });
        });
    } catch (err) {
        console.error('Error uploading figure image:', err);
        next(err);
    }
});

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

        // Robust deduplication: Remove duplicates by ID, order+title, and order+bodyMarkdown
        const seenById = new Map();
        const seenByOrderTitle = new Map();
        const seenByOrderBody = new Map();
        const uniqueSections = [];
        
        for (const s of sections) {
            let isDuplicate = false;
            
            if (s.id) {
                // Check by ID first
                if (seenById.has(s.id)) {
                    console.log(`Warning: Duplicate section ID ${s.id} found in request, skipping`);
                    isDuplicate = true;
                } else {
                    seenById.set(s.id, true);
                }
            }
            
            if (!isDuplicate) {
                // Check by order + title
                const keyOrderTitle = `${s.order || 0}-${(s.title || '').trim()}`;
                if (seenByOrderTitle.has(keyOrderTitle)) {
                    console.log(`Warning: Duplicate section with order ${s.order} and title "${s.title}" found, skipping`);
                    isDuplicate = true;
                } else {
                    seenByOrderTitle.set(keyOrderTitle, true);
                }
            }
            
            if (!isDuplicate) {
                // Also check by order + bodyMarkdown (first 100 chars) as additional safeguard
                const bodyPreview = (s.bodyMarkdown || '').substring(0, 100).trim();
                const keyOrderBody = `${s.order || 0}-${bodyPreview}`;
                if (seenByOrderBody.has(keyOrderBody) && bodyPreview.length > 0) {
                    console.log(`Warning: Duplicate section with order ${s.order} and similar body found, skipping`);
                    isDuplicate = true;
                } else if (bodyPreview.length > 0) {
                    seenByOrderBody.set(keyOrderBody, true);
                }
            }
            
            if (!isDuplicate) {
                uniqueSections.push(s);
            }
        }
        
        if (uniqueSections.length !== sections.length) {
            console.log(`Deduplication: ${sections.length} sections received, ${uniqueSections.length} unique sections after deduplication`);
        }

        let totalWords = 0;

        for (const s of uniqueSections) {
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
                    console.log(`Section ${s.id} not found, checking for existing section with same order+title`);
                    // If section ID not found, check if section with same order+title exists
                    const existing = await ArticleSection.findOne({
                        where: {
                            articleId: article.id,
                            order: s.order,
                            title: s.title
                        }
                    });
                    if (existing) {
                        console.log(`Found existing section ${existing.id} with same order+title, updating it`);
                        section = existing;
                    } else {
                        console.log(`No existing section found, creating new one`);
                        section = await ArticleSection.create({
                            articleId: article.id,
                            order: s.order,
                            title: s.title,
                            bodyMarkdown: s.bodyMarkdown,
                            bodyHtml: safeHtml,
                        });
                        console.log(`Created section ${section.id}`);
                    }
                } else {
                    await section.update({
                        order: s.order,
                        title: s.title,
                        bodyMarkdown: s.bodyMarkdown,
                        bodyHtml: safeHtml,
                    });
                    console.log(`Updated section ${s.id}`);
                }
            } else {
                // Check if section with same order+title already exists
                const existing = await ArticleSection.findOne({
                    where: {
                        articleId: article.id,
                        order: s.order,
                        title: s.title
                    }
                });
                if (existing) {
                    console.log(`Found existing section ${existing.id} with same order+title, updating it instead of creating new`);
                    section = existing;
                    await section.update({
                        order: s.order,
                        title: s.title,
                        bodyMarkdown: s.bodyMarkdown,
                        bodyHtml: safeHtml,
                    });
                    console.log(`Updated existing section ${section.id}`);
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
            }

            if (Array.isArray(s.figures)) {
                // Step 1: Deduplicate figures in the request
                const seenById = new Map();
                const seenByOrderUrl = new Map();
                const uniqueFigures = [];
                
                for (const f of s.figures) {
                    // Validate required fields
                    if (!f.imageUrl || typeof f.imageUrl !== 'string' || f.imageUrl.trim() === '') {
                        console.log(`Warning: Skipping figure with invalid or empty imageUrl`);
                        continue;
                    }
                    
                    // Validate order is a number
                    if (f.order !== undefined && (typeof f.order !== 'number' || isNaN(f.order))) {
                        console.log(`Warning: Invalid order for figure, defaulting to 0`);
                        f.order = 0;
                    }
                    
                    // Validate ID if present
                    if (f.id !== undefined && (typeof f.id !== 'number' || isNaN(f.id) || f.id <= 0)) {
                        console.log(`Warning: Invalid ID for figure, treating as new figure`);
                        f.id = undefined;
                    }
                    
                    let isDuplicate = false;
                    
                    // Check by ID first (most reliable)
                    if (f.id && typeof f.id === 'number') {
                        if (seenById.has(f.id)) {
                            console.log(`Warning: Duplicate figure ID ${f.id} found in request, skipping`);
                            isDuplicate = true;
                        } else {
                            seenById.set(f.id, true);
                        }
                    }
                    
                    // Check by order+imageUrl (for figures without IDs or as backup)
                    if (!isDuplicate) {
                        const key = `${f.order || 0}-${(f.imageUrl || '').trim()}`;
                        if (seenByOrderUrl.has(key)) {
                            console.log(`Warning: Duplicate figure with order ${f.order} and imageUrl "${f.imageUrl}" found, skipping`);
                            isDuplicate = true;
                        } else {
                            seenByOrderUrl.set(key, true);
                        }
                    }
                    
                    if (!isDuplicate) {
                        uniqueFigures.push(f);
                    }
                }
                
                // Step 2: Get all existing figures for this section
                const existingFigures = await ArticleFigure.findAll({
                    where: { sectionId: section.id }
                });
                
                // Step 3: Build maps for efficient lookup
                const existingById = new Map();
                const existingByOrderUrl = new Map();
                existingFigures.forEach(fig => {
                    if (fig.id) existingById.set(fig.id, fig);
                    const key = `${fig.order}-${fig.imageUrl}`;
                    existingByOrderUrl.set(key, fig);
                });
                
                // Step 4: Identify figures to keep, update, and delete
                const figuresToKeep = new Set();
                const figuresToUpdate = [];
                const figuresToCreate = [];
                
                for (const f of uniqueFigures) {
                    let existingFig = null;
                    
                    // Try to find by ID first
                    if (f.id && typeof f.id === 'number') {
                        existingFig = existingById.get(f.id);
                        // Validate that the figure belongs to this section
                        if (existingFig && existingFig.sectionId !== section.id) {
                            console.log(`Warning: Figure ${f.id} belongs to different section, treating as new`);
                            existingFig = null;
                        }
                    }
                    
                    // If not found by ID, try by order+imageUrl
                    if (!existingFig) {
                        const key = `${f.order || 0}-${(f.imageUrl || '').trim()}`;
                        existingFig = existingByOrderUrl.get(key);
                    }
                    
                    if (existingFig) {
                        figuresToKeep.add(existingFig.id);
                        figuresToUpdate.push({ existing: existingFig, data: f });
                    } else {
                        figuresToCreate.push(f);
                    }
                }
                
                // Step 5: Delete orphaned figures (not in the new list)
                for (const existingFig of existingFigures) {
                    if (!figuresToKeep.has(existingFig.id)) {
                        console.log(`Deleting orphaned figure ${existingFig.id}`);
                        await existingFig.destroy();
                    }
                }
                
                // Step 6: Update existing figures
                for (const { existing, data } of figuresToUpdate) {
                    await existing.update({
                        sectionId: section.id, // Ensure correct section
                        order: data.order || existing.order,
                        imageUrl: data.imageUrl || existing.imageUrl,
                        caption: data.caption || null,
                        altText: data.altText || null,
                    });
                }
                
                // Step 7: Create new figures
                for (const f of figuresToCreate) {
                    const newFig = await ArticleFigure.create({
                        sectionId: section.id,
                        order: f.order || 0,
                        imageUrl: f.imageUrl.trim(),
                        caption: f.caption || null,
                        altText: f.altText || null,
                    });
                    console.log(`Created new figure ${newFig.id} for section ${section.id}`);
                }
            } else {
                // If no figures array provided, delete all existing figures for this section
                const existingFigures = await ArticleFigure.findAll({
                    where: { sectionId: section.id }
                });
                for (const fig of existingFigures) {
                    await fig.destroy();
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
        const article = await Article.findByPk(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });
        
        // Fetch sections separately to avoid JOIN duplication
        const sections = await ArticleSection.findAll({
            where: { articleId: article.id },
            order: [['order', 'ASC']],
        });
        
        // Fetch figures separately for each section
        const sectionsWithFigures = await Promise.all(
            sections.map(async (section) => {
                const figures = await ArticleFigure.findAll({
                    where: { sectionId: section.id },
                    order: [['order', 'ASC']],
                });
                
                // Deduplicate figures by ID, or by order+imageUrl if no ID
                const seenById = new Map();
                const seenByOrderUrl = new Map();
                const uniqueFigures = [];
                
                for (const figure of figures) {
                    const figData = figure.toJSON();
                    let isDuplicate = false;
                    
                    if (figData.id && seenById.has(figData.id)) {
                        isDuplicate = true;
                    } else if (figData.id) {
                        seenById.set(figData.id, true);
                    }
                    
                    if (!isDuplicate) {
                        const key = `${figData.order || 0}-${figData.imageUrl || ''}`;
                        if (seenByOrderUrl.has(key)) {
                            isDuplicate = true;
                        } else {
                            seenByOrderUrl.set(key, true);
                        }
                    }
                    
                    if (!isDuplicate) {
                        uniqueFigures.push(figData);
                    }
                }
                
                // Convert to plain objects
                const sectionData = section.toJSON();
                sectionData.figures = uniqueFigures;
                return sectionData;
            })
        );
        
        // Convert article to plain object and attach sections
        const articleData = article.toJSON();
        articleData.sections = sectionsWithFigures;
        
        res.json({ article: articleData });
    } catch (e) {
        next(e);
    }
});

// Delete article (admin only)
router.delete('/:id', auth, async (req, res, next) => {
    try {
        const articleId = req.params.id;
        const article = await Article.findByPk(articleId, {
            include: [
                { model: ArticleSection, as: 'sections', include: [{ model: ArticleFigure, as: 'figures' }] },
            ],
        });

        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }

        // Delete cover image from S3 if it exists
        if (article.coverImage) {
            try {
                // Extract key from S3 URL
                // URLs can be: https://bucket.s3.region.amazonaws.com/Articles/cover-xxx.jpg
                // or: https://s3.region.amazonaws.com/bucket/Articles/cover-xxx.jpg
                const coverImageUrl = article.coverImage;
                let key = null;
                
                // Try to extract the key from different URL formats
                const urlMatch1 = coverImageUrl.match(/\/Articles\/(cover-[^/?]+)/);
                const urlMatch2 = coverImageUrl.match(/s3[^/]*\/[^/]+\/Articles\/(cover-[^/?]+)/);
                
                if (urlMatch1) {
                    key = `Articles/${urlMatch1[1]}`;
                } else if (urlMatch2) {
                    key = `Articles/${urlMatch2[1]}`;
                } else if (coverImageUrl.includes('Articles/')) {
                    // Fallback: extract everything after Articles/
                    const parts = coverImageUrl.split('Articles/');
                    if (parts.length > 1) {
                        key = `Articles/${parts[1].split('?')[0]}`; // Remove query params
                    }
                }
                
                if (key) {
                    try {
                        await s3.deleteObject({
                            Bucket: process.env.S3_BUCKET_NAME,
                            Key: key
                        }).promise();
                        console.log(`✅ Successfully deleted cover image: ${key}`);
                    } catch (deleteErr) {
                        console.error(`❌ Failed to delete cover image ${key}:`, deleteErr.message);
                        console.error('Error details:', JSON.stringify(deleteErr, null, 2));
                        // Check if it's a permissions error
                        if (deleteErr.code === 'AccessDenied' || deleteErr.statusCode === 403) {
                            console.error('⚠️  IAM permission issue: Your IAM user needs s3:DeleteObject permission');
                        }
                        // Continue with deletion even if S3 delete fails
                    }
                } else {
                    console.warn(`⚠️  Could not extract S3 key from cover image URL: ${coverImageUrl}`);
                }
            } catch (s3Err) {
                console.error('Error processing cover image deletion:', s3Err);
                // Continue with deletion even if S3 delete fails
            }
        }

        // Delete all figure images from S3
        if (article.sections) {
            for (const section of article.sections) {
                if (section.figures) {
                    for (const figure of section.figures) {
                        if (figure.imageUrl) {
                            try {
                                // Extract key from S3 URL
                                const figureUrl = figure.imageUrl;
                                let key = null;
                                
                                // Try to extract the key from different URL formats
                                const urlMatch1 = figureUrl.match(/\/Articles\/(figure-[^/?]+)/);
                                const urlMatch2 = figureUrl.match(/s3[^/]*\/[^/]+\/Articles\/(figure-[^/?]+)/);
                                
                                if (urlMatch1) {
                                    key = `Articles/${urlMatch1[1]}`;
                                } else if (urlMatch2) {
                                    key = `Articles/${urlMatch2[1]}`;
                                } else if (figureUrl.includes('Articles/')) {
                                    // Fallback: extract everything after Articles/
                                    const parts = figureUrl.split('Articles/');
                                    if (parts.length > 1) {
                                        key = `Articles/${parts[1].split('?')[0]}`; // Remove query params
                                    }
                                }
                                
                                if (key) {
                                    try {
                                        await s3.deleteObject({
                                            Bucket: process.env.S3_BUCKET_NAME,
                                            Key: key
                                        }).promise();
                                        console.log(`✅ Successfully deleted figure image: ${key}`);
                                    } catch (deleteErr) {
                                        console.error(`❌ Failed to delete figure image ${key}:`, deleteErr.message);
                                        console.error('Error details:', JSON.stringify(deleteErr, null, 2));
                                        // Check if it's a permissions error
                                        if (deleteErr.code === 'AccessDenied' || deleteErr.statusCode === 403) {
                                            console.error('⚠️  IAM permission issue: Your IAM user needs s3:DeleteObject permission');
                                        }
                                        // Continue with deletion
                                    }
                                } else {
                                    console.warn(`⚠️  Could not extract S3 key from figure URL: ${figureUrl}`);
                                }
                            } catch (s3Err) {
                                console.error('Error processing figure image deletion:', s3Err);
                                // Continue with deletion
                            }
                        }
                    }
                }
            }
        }

        // Delete the article (cascade will delete sections and figures)
        await article.destroy();

        res.json({ message: 'Article deleted successfully' });
    } catch (err) {
        console.error('Error deleting article:', err);
        next(err);
    }
});

// Public fetch by slug (must be last to avoid conflicts with other routes)
router.get('/:slug', async (req, res, next) => {
    try {
        const article = await Article.findOne({
            where: { slug: req.params.slug, status: 'published' },
        });
        if (!article) return res.status(404).json({ message: 'Not found' });
        
        // Fetch sections separately to avoid JOIN duplication
        const sections = await ArticleSection.findAll({
            where: { articleId: article.id },
            order: [['order', 'ASC']],
        });
        
        // Fetch figures separately for each section
        const sectionsWithFigures = await Promise.all(
            sections.map(async (section) => {
                const figures = await ArticleFigure.findAll({
                    where: { sectionId: section.id },
                    order: [['order', 'ASC']],
                });
                
                // Deduplicate figures by ID, or by order+imageUrl if no ID
                const seenById = new Map();
                const seenByOrderUrl = new Map();
                const uniqueFigures = [];
                
                for (const figure of figures) {
                    const figData = figure.toJSON();
                    let isDuplicate = false;
                    
                    if (figData.id && seenById.has(figData.id)) {
                        isDuplicate = true;
                    } else if (figData.id) {
                        seenById.set(figData.id, true);
                    }
                    
                    if (!isDuplicate) {
                        const key = `${figData.order || 0}-${figData.imageUrl || ''}`;
                        if (seenByOrderUrl.has(key)) {
                            isDuplicate = true;
                        } else {
                            seenByOrderUrl.set(key, true);
                        }
                    }
                    
                    if (!isDuplicate) {
                        uniqueFigures.push(figData);
                    }
                }
                
                // Convert to plain objects
                const sectionData = section.toJSON();
                sectionData.figures = uniqueFigures;
                return sectionData;
            })
        );
        
        // Convert article to plain object and attach sections
        const articleData = article.toJSON();
        articleData.sections = sectionsWithFigures;
        
        res.json({ article: articleData });
    } catch (e) {
        next(e);
    }
});

module.exports = router;