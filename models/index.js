const Album = require('./Album');
const Photo = require('./Photo');
const User = require('./User');
const AppUser = require('./AppUser');
const Announcements = require('./Announcements');
const ImageLike = require('./ImageLike');

// New article stack
const Article = require('./Article');
const ArticleSection = require('./ArticleSection');
const ArticleFigure = require('./ArticleFigure');
const Tag = require('./Tag');
const ArticleTag = require('./ArticleTag');
const Message = require('./Message');

// Add Associations here

// Albums ↔ Photos
Album.hasMany(Photo, { foreignKey: 'albumId', onDelete: 'CASCADE' });
Photo.belongsTo(Album, { foreignKey: 'albumId' });

// Likes ↔ Users & Albums
AppUser.hasMany(ImageLike, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ImageLike.belongsTo(AppUser, { foreignKey: 'user_id' });

Album.hasMany(ImageLike, { foreignKey: 'album_id', onDelete: 'CASCADE' });
ImageLike.belongsTo(Album, { foreignKey: 'album_id' });

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
    AppUser,
    Announcements,
    Album,
    Photo,

    // New:
    Article,
    ArticleSection,
    ArticleFigure,
    Tag,
    ArticleTag,
    Message,
    ImageLike
};