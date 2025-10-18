// models/ArticleFigure.js
const Sequelize = require('sequelize');
const db = require('../config/database');


const ArticleFigure = db.define('article_figures', {
  sectionId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { model: 'article_sections', key: 'id' },
    onDelete: 'CASCADE'
  },
  order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
  imageUrl: { type: Sequelize.STRING, allowNull: false },
  caption: { type: Sequelize.STRING(512), allowNull: true },
  altText: { type: Sequelize.STRING(256), allowNull: true },
}, {
  indexes: [{ fields: ['sectionId', 'order'] }],
});


module.exports = ArticleFigure;