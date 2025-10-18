// models/Tag.js
const Sequelize = require('sequelize');
const db = require('../config/database');

const Tag = db.define('tags', {
    name: { type: Sequelize.STRING(64), allowNull: false, unique: true },
});

module.exports = Tag;