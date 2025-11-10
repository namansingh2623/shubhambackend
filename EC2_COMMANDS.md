# EC2 Commands to Check RDS Articles

## Step 1: Install MySQL Client

```bash
# For Amazon Linux 2 (try these in order):

# Option 1: Enable EPEL and install
sudo yum install epel-release -y
sudo yum install mysql -y

# Option 2: Try MariaDB from Amazon Linux extras
sudo amazon-linux-extras list | grep mariadb
sudo amazon-linux-extras install mariadb10.5 -y
sudo yum install mariadb -y

# Option 3: Install from MySQL repository
sudo yum install https://dev.mysql.com/get/mysql80-community-release-el7-3.noarch.rpm -y
sudo yum install mysql-community-client -y

# Option 4: Use dnf if available (newer Amazon Linux)
sudo dnf install mysql -y

# Verify installation
which mysql
mysql --version
```

**If all above fail, use Node.js method below (no installation needed)**

## Step 2: Connect to RDS

```bash
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com \
      -u admin \
      -pshubham116 \
      shubham
```

## Step 3: Check Articles (Inside MySQL)

```sql
-- Check total articles
SELECT COUNT(*) as total_articles FROM articles;

-- List all articles
SELECT id, title, slug, coverImage, status FROM articles ORDER BY id;

-- Check articles with cover images
SELECT id, title, coverImage FROM articles WHERE coverImage IS NOT NULL AND coverImage != '';

-- Check articles with sections and figures
SELECT 
    a.id,
    a.title,
    COUNT(DISTINCT s.id) as sections,
    COUNT(DISTINCT f.id) as figures
FROM articles a
LEFT JOIN article_sections s ON a.id = s.articleId
LEFT JOIN article_figures f ON s.id = f.sectionId
GROUP BY a.id, a.title;

-- List all figure image URLs
SELECT 
    a.id as article_id,
    a.title,
    f.imageUrl
FROM articles a
JOIN article_sections s ON a.id = s.articleId
JOIN article_figures f ON s.id = f.sectionId
ORDER BY a.id;

-- Exit MySQL
EXIT;
```

## Quick One-Liner Queries (Without Entering MySQL)

```bash
# Count articles
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com -u admin -pshubham116 shubham -e "SELECT COUNT(*) FROM articles;"

# List all articles
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com -u admin -pshubham116 shubham -e "SELECT id, title, coverImage FROM articles;"

# List articles with cover images
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com -u admin -pshubham116 shubham -e "SELECT id, title, coverImage FROM articles WHERE coverImage IS NOT NULL;"

# Count figure images
mysql -h shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com -u admin -pshubham116 shubham -e "SELECT COUNT(*) FROM article_figures;"
```

## Alternative: Use Node.js (EASIEST - No Installation Needed)

Since you already have Node.js on EC2, use this method:

```bash
# Navigate to your backend directory
cd ~/project  # or wherever your backend code is

# Quick check - count articles
node -e "
const Sequelize = require('sequelize');
const db = new Sequelize('shubham', 'admin', 'shubham116', {
    host: 'shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com',
    dialect: 'mysql',
    logging: false
});
db.query('SELECT COUNT(*) as total FROM articles').then(([results]) => {
    console.log('Total articles:', results[0].total);
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
"

# List all articles with cover images
node -e "
const Sequelize = require('sequelize');
const db = new Sequelize('shubham', 'admin', 'shubham116', {
    host: 'shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com',
    dialect: 'mysql',
    logging: false
});
db.query('SELECT id, title, coverImage FROM articles WHERE coverImage IS NOT NULL').then(([results]) => {
    console.log('Articles with cover images:');
    results.forEach(a => console.log(\`  ID: \${a.id}, Title: \${a.title}, Cover: \${a.coverImage}\`));
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
"

# List all figure images
node -e "
const Sequelize = require('sequelize');
const db = new Sequelize('shubham', 'admin', 'shubham116', {
    host: 'shubhamrdsinstance.c3yk0auy82wi.ap-south-1.rds.amazonaws.com',
    dialect: 'mysql',
    logging: false
});
db.query('SELECT a.id, a.title, f.imageUrl FROM articles a JOIN article_sections s ON a.id = s.articleId JOIN article_figures f ON s.id = f.sectionId').then(([results]) => {
    console.log('Figure images:');
    results.forEach(f => console.log(\`  Article \${f.id} (\${f.title}): \${f.imageUrl}\`));
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
"
```

## List S3 Images

```bash
# List all images in Articles folder
aws s3 ls s3://radiobucketnaman/Articles/ --recursive

# Save to file
aws s3 ls s3://radiobucketnaman/Articles/ --recursive > s3-images.txt
cat s3-images.txt
```

## Delete Images from S3 (After Verifying They're Not in DB)

```bash
# Delete single image
aws s3 rm s3://radiobucketnaman/Articles/cover-xxx.jpg

# Delete multiple (be careful!)
aws s3 rm s3://radiobucketnaman/Articles/ --recursive --exclude "*" --include "cover-xxx.jpg" --include "figure-yyy.jpg"
```
