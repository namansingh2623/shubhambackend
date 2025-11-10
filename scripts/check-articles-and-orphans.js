#!/usr/bin/env node
/**
 * Script to check articles in RDS and find orphaned S3 images
 * Run on EC2: node scripts/check-articles-and-orphans.js
 */

const Sequelize = require('sequelize');
const { execSync } = require('child_process');
require('dotenv').config();

// Use RDS credentials (uncomment in .env first)
const sequelize = new Sequelize(
    process.env.MYSQL_DB_NAME || 'shubham',
    process.env.MYSQL_USERNAME || 'admin',
    process.env.MYSQL_PASSWORD || 'shubham116',
    {
        host: process.env.MYSQL_HOST_NAME || 'shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com',
        dialect: 'mysql',
        logging: false
    }
);

async function checkArticlesAndOrphans() {
    try {
        console.log('🔌 Connecting to RDS...');
        await sequelize.authenticate();
        console.log('✅ Connected to RDS successfully\n');

        // 1. Check total articles
        const [articlesCount] = await sequelize.query(`
            SELECT COUNT(*) as total FROM articles
        `);
        console.log(`📊 Total articles in database: ${articlesCount[0].total}\n`);

        // 2. List all articles
        const [allArticles] = await sequelize.query(`
            SELECT id, title, slug, coverImage, status, createdAt 
            FROM articles 
            ORDER BY id
        `);
        
        if (allArticles.length === 0) {
            console.log('⚠️  No articles found in database!\n');
        } else {
            console.log('📝 All Articles:');
            console.log('─'.repeat(80));
            allArticles.forEach(a => {
                const cover = a.coverImage ? '✅' : '❌';
                console.log(`  ${cover} ID: ${a.id} | Title: "${a.title}" | Status: ${a.status} | Cover: ${a.coverImage ? 'Yes' : 'No'}`);
            });
            console.log('');
        }

        // 3. Check articles with cover images
        const [withCovers] = await sequelize.query(`
            SELECT id, title, coverImage 
            FROM articles 
            WHERE coverImage IS NOT NULL AND coverImage != ''
        `);
        console.log(`🖼️  Articles with cover images: ${withCovers.length}`);
        if (withCovers.length > 0) {
            withCovers.forEach(a => {
                // Extract S3 key from URL
                const match = a.coverImage.match(/\/Articles\/([^/?]+)/);
                const key = match ? `Articles/${match[1]}` : 'Unknown';
                console.log(`    Article ${a.id}: ${key}`);
            });
            console.log('');
        }

        // 4. Check articles with sections and figures
        const [withFigures] = await sequelize.query(`
            SELECT 
                a.id as article_id,
                a.title,
                COUNT(DISTINCT s.id) as sections,
                COUNT(DISTINCT f.id) as figures
            FROM articles a
            LEFT JOIN article_sections s ON a.id = s.articleId
            LEFT JOIN article_figures f ON s.id = f.sectionId
            GROUP BY a.id, a.title
            ORDER BY a.id
        `);
        console.log(`📸 Articles breakdown:`);
        withFigures.forEach(a => {
            console.log(`    Article ${a.article_id} (${a.title}): ${a.sections} sections, ${a.figures} figures`);
        });
        console.log('');

        // 5. Get all image URLs from database
        const [covers] = await sequelize.query(`
            SELECT coverImage FROM articles 
            WHERE coverImage IS NOT NULL AND coverImage != ''
        `);
        
        const [figures] = await sequelize.query(`
            SELECT imageUrl FROM article_figures WHERE imageUrl IS NOT NULL
        `);

        const dbImages = new Set();
        
        covers.forEach(c => {
            if (c.coverImage) {
                // Extract key from URL - handle different URL formats
                const match1 = c.coverImage.match(/\/Articles\/([^/?]+)/);
                const match2 = c.coverImage.match(/s3[^/]*\/[^/]+\/Articles\/([^/?]+)/);
                if (match1) {
                    dbImages.add(`Articles/${match1[1]}`);
                } else if (match2) {
                    dbImages.add(`Articles/${match2[1]}`);
                } else if (c.coverImage.includes('Articles/')) {
                    const parts = c.coverImage.split('Articles/');
                    if (parts.length > 1) {
                        dbImages.add(`Articles/${parts[1].split('?')[0]}`);
                    }
                }
            }
        });
        
        figures.forEach(f => {
            if (f.imageUrl) {
                const match1 = f.imageUrl.match(/\/Articles\/([^/?]+)/);
                const match2 = f.imageUrl.match(/s3[^/]*\/[^/]+\/Articles\/([^/?]+)/);
                if (match1) {
                    dbImages.add(`Articles/${match1[1]}`);
                } else if (match2) {
                    dbImages.add(`Articles/${match2[1]}`);
                } else if (f.imageUrl.includes('Articles/')) {
                    const parts = f.imageUrl.split('Articles/');
                    if (parts.length > 1) {
                        dbImages.add(`Articles/${parts[1].split('?')[0]}`);
                    }
                }
            }
        });

        console.log(`📊 Total unique images referenced in database: ${dbImages.size}\n`);

        // 6. List S3 images (if AWS CLI is available)
        console.log('🔍 Checking S3 bucket for images...');
        let s3Images = new Set();
        try {
            const s3Output = execSync('aws s3 ls s3://radiobucketnaman/Articles/ --recursive', { 
                encoding: 'utf-8',
                stdio: 'pipe'
            });
            
            s3Output.split('\n').forEach(line => {
                if (line.trim()) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 4) {
                        const key = parts.slice(3).join(' ');
                        if (key.startsWith('Articles/')) {
                            s3Images.add(key);
                        }
                    }
                }
            });
            console.log(`📦 Total images in S3 Articles folder: ${s3Images.size}\n`);
        } catch (s3Error) {
            console.log(`⚠️  Could not list S3 images: ${s3Error.message}`);
            console.log('   Make sure AWS CLI is installed and configured on EC2\n');
        }

        // 7. Find orphaned images (in S3 but not in DB)
        if (s3Images.size > 0) {
            const orphaned = [];
            s3Images.forEach(s3Key => {
                if (!dbImages.has(s3Key)) {
                    orphaned.push(s3Key);
                }
            });

            console.log(`🗑️  Orphaned images (in S3 but not referenced in database): ${orphaned.length}`);
            if (orphaned.length > 0) {
                console.log('\n   Orphaned image keys:');
                orphaned.forEach(img => console.log(`     ${img}`));
                console.log('\n   To delete these images, run:');
                orphaned.forEach(img => {
                    console.log(`     aws s3 rm s3://radiobucketnaman/${img}`);
                });
            } else {
                console.log('   ✅ No orphaned images found!');
            }
        }

        // 8. Find missing images (in DB but not in S3)
        if (s3Images.size > 0) {
            const missing = [];
            dbImages.forEach(dbKey => {
                if (!s3Images.has(dbKey)) {
                    missing.push(dbKey);
                }
            });

            if (missing.length > 0) {
                console.log(`\n⚠️  Missing images (referenced in DB but not in S3): ${missing.length}`);
                missing.forEach(img => console.log(`     ${img}`));
            }
        }

        await sequelize.close();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.error('\n💡 Tip: Make sure:');
            console.error('   1. RDS security group allows connections from EC2');
            console.error('   2. MYSQL_HOST_NAME in .env points to RDS endpoint');
            console.error('   3. RDS credentials are correct');
        }
        process.exit(1);
    }
}

checkArticlesAndOrphans();

