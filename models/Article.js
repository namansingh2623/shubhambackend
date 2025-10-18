// models/Article.js
const Sequelize = require('sequelize');
const db = require('../config/database');

const Article = db.define('articles', {
    title: { type: Sequelize.STRING, allowNull: false },

    // unique URL slug
    slug: { type: Sequelize.STRING, allowNull: false, unique: true },

    // short summary for cards/SEO
    excerpt: { type: Sequelize.STRING(512), allowNull: true },

    // NOTE: using "coverImage" to match your routes
    coverImage: { type: Sequelize.STRING, allowNull: true },

    // raw markdown edited by admin
    contentMarkdown: { type: Sequelize.TEXT('long'), allowNull: false },

    // sanitized HTML rendered from the markdown
    // (no defaultValue on TEXT in MySQL)
    contentHtml: { type: Sequelize.TEXT('long'), allowNull: false },

    // workflow + meta
    status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    publishedAt: { type: Sequelize.DATE, allowNull: true },
    author: { type: Sequelize.STRING, allowNull: false },
    readingTime: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
}, {
    indexes: [{ unique: true, fields: ['slug'] }],
});

// Ensure non-null strings for TEXT fields at validation time (no DB defaults)
Article.addHook('beforeValidate', (article) => {
    if (article.contentMarkdown == null) article.contentMarkdown = '';
    if (article.contentHtml == null) article.contentHtml = '';
});

module.exports = Article;