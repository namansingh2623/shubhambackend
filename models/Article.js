// models/Article.js
const Sequelize = require('sequelize');
const db = require('../config/database');

const Article = db.define('articles', {
    title: { type: Sequelize.STRING, allowNull: false },
    slug: { type: Sequelize.STRING, allowNull: false, unique: true },
    excerpt: { type: Sequelize.STRING(512), allowNull: true },
    coverImageUrl: { type: Sequelize.STRING, allowNull: true },
    status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
    publishedAt: { type: Sequelize.DATE, allowNull: true },
    author: { type: Sequelize.STRING, allowNull: false },
    readingTime: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
}, {
    indexes: [{ unique: true, fields: ['slug'] }],
});

module.exports = Article;