const Album = require('./Album');
const Photo = require('./Photo');
const User = require('./User');
const Announcements = require('./Announcements');

// New article stack
const Article = require('./Article');
const ArticleSection = require('./ArticleSection');
const ArticleFigure = require('./ArticleFigure');
const Tag = require('./Tag');
const ArticleTag = require('./ArticleTag');

// Add Associations here

// Albums ↔ Photos
Album.hasMany(Photo, { foreignKey: 'albumId', onDelete: 'CASCADE' });
Photo.belongsTo(Album, { foreignKey: 'albumId' });

// Articles → Sections → Figures
Article.hasMany(ArticleSection, {
    as: 'sections',
    foreignKey: 'articleId',
    onDelete: 'CASCADE',
});
ArticleSection.belongsTo(Article, { foreignKey: 'articleId' });

ArticleSection.hasMany(ArticleFigure, {
    as: 'figures',
    foreignKey: 'sectionId',
    onDelete: 'CASCADE',
});
ArticleFigure.belongsTo(ArticleSection, { foreignKey: 'sectionId' });

// Optional: tags
Article.belongsToMany(Tag, { through: ArticleTag, foreignKey: 'articleId' });
Tag.belongsToMany(Article, { through: ArticleTag, foreignKey: 'tagId' });

// Export all models
module.exports = {
    User,
    Announcements,
    Album,
    Photo,

    // New:
    Article,
    ArticleSection,
    ArticleFigure,
    Tag,
    ArticleTag,
};