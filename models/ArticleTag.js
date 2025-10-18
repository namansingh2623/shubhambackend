// models/ArticleTag.js (join table)
const Sequelize = require('sequelize');
const db = require('../config/database');

const ArticleTag = db.define('article_tags', {
    articleId: {
        type: Sequelize.INTEGER,
        references: { model: 'articles', key: 'id' },
        onDelete: 'CASCADE'
    },
    tagId: {
        type: Sequelize.INTEGER,
        references: { model: 'tags', key: 'id' },
        onDelete: 'CASCADE'
    },
});


module.exports = ArticleTag;