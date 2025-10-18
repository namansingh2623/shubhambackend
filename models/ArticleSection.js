// models/ArticleSection.js
const Sequelize = require('sequelize');
const db = require('../config/database');


const ArticleSection = db.define('article_sections', {
    articleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'articles', key: 'id' },
        onDelete: 'CASCADE'
    },
    order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    title: { type: Sequelize.STRING, allowNull: false },
    bodyMarkdown: { type: Sequelize.TEXT('long'), allowNull: false },
    bodyHtml: { type: Sequelize.TEXT('long'), allowNull: false},
}, {
    indexes: [{ fields: ['articleId', 'order'] }],
});


module.exports = ArticleSection;