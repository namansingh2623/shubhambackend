# Connect to RDS from EC2

## Method 1: Using MySQL Client (Recommended)

### Step 1: Install MySQL Client on EC2

```bash
# SSH into EC2
ssh ec2-user@your-ec2-ip

# Install MySQL client
sudo yum install mysql -y
# or for Ubuntu/Debian:
# sudo apt-get install mysql-client -y
```

### Step 2: Connect to RDS

```bash
# Connect using your RDS credentials
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com \
      -u admin \
      -p \
      shubham

# Enter password when prompted: shubham116
```

### Step 3: Check Articles

Once connected, run these queries:

```sql
-- Check total number of articles
SELECT COUNT(*) as total_articles FROM articles;

-- List all articles with their IDs and cover images
SELECT id, title, slug, coverImage, status, createdAt 
FROM articles 
ORDER BY id;

-- Check articles with cover images
SELECT id, title, coverImage 
FROM articles 
WHERE coverImage IS NOT NULL AND coverImage != '';

-- Check articles with sections and figures
SELECT 
    a.id as article_id,
    a.title,
    a.coverImage,
    COUNT(DISTINCT s.id) as section_count,
    COUNT(DISTINCT f.id) as figure_count
FROM articles a
LEFT JOIN article_sections s ON a.id = s.articleId
LEFT JOIN article_figures f ON s.id = f.sectionId
GROUP BY a.id, a.title, a.coverImage;

-- List all figure images
SELECT 
    a.id as article_id,
    a.title as article_title,
    s.id as section_id,
    s.title as section_title,
    f.id as figure_id,
    f.imageUrl,
    f.order as figure_order
FROM articles a
JOIN article_sections s ON a.id = s.articleId
JOIN article_figures f ON s.id = f.sectionId
ORDER BY a.id, s.order, f.order;

-- Check for articles with no sections (empty articles)
SELECT id, title, coverImage, status 
FROM articles 
WHERE id NOT IN (SELECT DISTINCT articleId FROM article_sections);

-- Exit MySQL
EXIT;
```

## Method 2: Using Node.js Script

Create a script to check articles:

```bash
# On EC2, create a script
nano check-articles.js
```

Paste this:

```javascript
// check-articles.js
const Sequelize = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.MYSQL_DB_NAME,
    process.env.MYSQL_USERNAME,
    process.env.MYSQL_PASSWORD,
    {
        host: process.env.MYSQL_HOST_NAME,
        dialect: 'mysql',
        logging: false
    }
);

async function checkArticles() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to RDS successfully');

        // Check total articles
        const [articles] = await sequelize.query(`
            SELECT COUNT(*) as total FROM articles
        `);
        console.log(`\n📊 Total articles: ${articles[0].total}`);

        // List all articles
        const [allArticles] = await sequelize.query(`
            SELECT id, title, slug, coverImage, status, createdAt 
            FROM articles 
            ORDER BY id
        `);
        console.log('\n📝 All Articles:');
        allArticles.forEach(a => {
            console.log(`  ID: ${a.id}, Title: ${a.title}, Cover: ${a.coverImage ? 'Yes' : 'No'}, Status: ${a.status}`);
        });

        // Check articles with cover images
        const [withCovers] = await sequelize.query(`
            SELECT id, title, coverImage 
            FROM articles 
            WHERE coverImage IS NOT NULL AND coverImage != ''
        `);
        console.log(`\n🖼️  Articles with cover images: ${withCovers.length}`);
        withCovers.forEach(a => {
            console.log(`  ID: ${a.id}, Cover: ${a.coverImage}`);
        });

        // Check articles with figures
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
            HAVING COUNT(DISTINCT f.id) > 0
        `);
        console.log(`\n📸 Articles with figure images: ${withFigures.length}`);
        withFigures.forEach(a => {
            console.log(`  ID: ${a.article_id}, Title: ${a.title}, Sections: ${a.sections}, Figures: ${a.figures}`);
        });

        // List all figure image URLs
        const [figures] = await sequelize.query(`
            SELECT 
                a.id as article_id,
                a.title as article_title,
                f.imageUrl
            FROM articles a
            JOIN article_sections s ON a.id = s.articleId
            JOIN article_figures f ON s.id = f.sectionId
            ORDER BY a.id
        `);
        console.log(`\n🖼️  Total figure images: ${figures.length}`);
        figures.forEach(f => {
            console.log(`  Article ${f.article_id} (${f.article_title}): ${f.imageUrl}`);
        });

        await sequelize.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkArticles();
```

Run it:

```bash
# Make sure you're in the backend directory with .env file
cd /path/to/your/backend
node check-articles.js
```

## Method 3: Quick One-Liner Queries

```bash
# Connect and run a quick query
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com \
      -u admin \
      -pshubham116 \
      shubham \
      -e "SELECT id, title, coverImage FROM articles WHERE coverImage IS NOT NULL;"
```

## Find Orphaned S3 Images

After checking the database, you can identify orphaned images:

### Step 1: List all S3 images

```bash
# List all images in Articles folder
aws s3 ls s3://radiobucketnaman/Articles/ --recursive

# Save to file
aws s3 ls s3://radiobucketnaman/Articles/ --recursive > s3-images.txt
```

### Step 2: Compare with Database

Create a script to find orphaned images:

```bash
nano find-orphaned-images.js
```

```javascript
// find-orphaned-images.js
const { execSync } = require('child_process');
const Sequelize = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.MYSQL_DB_NAME,
    process.env.MYSQL_USERNAME,
    process.env.MYSQL_PASSWORD,
    {
        host: process.env.MYSQL_HOST_NAME,
        dialect: 'mysql',
        logging: false
    }
);

async function findOrphanedImages() {
    try {
        // Get all image URLs from database
        const [covers] = await sequelize.query(`
            SELECT coverImage FROM articles WHERE coverImage IS NOT NULL AND coverImage != ''
        `);
        
        const [figures] = await sequelize.query(`
            SELECT imageUrl FROM article_figures WHERE imageUrl IS NOT NULL
        `);

        const dbImages = new Set();
        covers.forEach(c => {
            if (c.coverImage) {
                // Extract key from URL
                const match = c.coverImage.match(/\/Articles\/([^/?]+)/);
                if (match) dbImages.add(`Articles/${match[1]}`);
            }
        });
        figures.forEach(f => {
            if (f.imageUrl) {
                const match = f.imageUrl.match(/\/Articles\/([^/?]+)/);
                if (match) dbImages.add(`Articles/${match[1]}`);
            }
        });

        console.log(`📊 Images in database: ${dbImages.size}`);

        // List S3 images
        const s3Output = execSync('aws s3 ls s3://radiobucketnaman/Articles/ --recursive', { encoding: 'utf-8' });
        const s3Images = new Set();
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

        console.log(`📦 Images in S3: ${s3Images.size}`);

        // Find orphaned (in S3 but not in DB)
        const orphaned = [];
        s3Images.forEach(s3Key => {
            if (!dbImages.has(s3Key)) {
                orphaned.push(s3Key);
            }
        });

        console.log(`\n🗑️  Orphaned images (in S3 but not in DB): ${orphaned.length}`);
        orphaned.forEach(img => console.log(`  ${img}`));

        await sequelize.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

findOrphanedImages();
```

## Delete Orphaned Images from S3

Once you've identified orphaned images, delete them:

```bash
# Delete a single image
aws s3 rm s3://radiobucketnaman/Articles/cover-xxx.jpg

# Delete multiple images (be careful!)
# First, save orphaned list to file
node find-orphaned-images.js > orphaned.txt

# Then delete (review the list first!)
while read img; do
    aws s3 rm s3://radiobucketnaman/$img
done < orphaned.txt
```

## Important Notes

⚠️ **Before deleting:**
1. ✅ Verify the database queries show which images are actually used
2. ✅ Double-check the orphaned images list
3. ✅ Consider backing up S3 bucket first
4. ✅ Test with one image first before bulk deletion

## Quick Reference

```bash
# Connect to RDS
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com -u admin -p shubham

# Check articles count
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com -u admin -pshubham116 shubham -e "SELECT COUNT(*) FROM articles;"

# List S3 images
aws s3 ls s3://radiobucketnaman/Articles/ --recursive
```

