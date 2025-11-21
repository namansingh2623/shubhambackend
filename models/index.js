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

// E-commerce models
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Cart = require('./Cart');
const CartItem = require('./CartItem');

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

// E-commerce associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Photo, { foreignKey: 'photoId' });

Cart.hasMany(CartItem, { foreignKey: 'cartId', onDelete: 'CASCADE' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(Photo, { foreignKey: 'photoId' });

// Optional: User associations for orders/carts
// User.hasMany(Order, { foreignKey: 'userId' });
// User.hasMany(Cart, { foreignKey: 'userId' });

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

    // E-commerce:
    Order,
    OrderItem,
    Cart,
    CartItem,
};