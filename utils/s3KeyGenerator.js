const uuid = require('uuid');

/**
 * Generate a short UUID (first 8 characters)
 */
const shortUuid = () => uuid.v4().substring(0, 8);

/**
 * Generate S3 key for album photos
 * Format: album-{albumId}/photo-{timestamp}-{shortUuid}.webp
 */
const generatePhotoKey = (albumId) => {
    const timestamp = Date.now();
    const uniqueId = shortUuid();
    return `album-${albumId}/photo-${timestamp}-${uniqueId}.webp`;
};

/**
 * Generate S3 key for premium album photos
 * Format: album-{albumId}/premium/photo-{photoId}-{shortUuid}.webp
 */
const generatePremiumPhotoKey = (albumId, photoId) => {
    const uniqueId = shortUuid();
    return `album-${albumId}/premium/photo-${photoId}-${uniqueId}.webp`;
};

/**
 * Generate S3 key for article cover images
 * Format: article-{articleId}/cover-{shortUuid}.webp
 * If articleId not provided, uses: articles/covers/{timestamp}-{shortUuid}.webp
 */
const generateArticleCoverKey = (articleId = null) => {
    const uniqueId = shortUuid();
    if (articleId) {
        return `article-${articleId}/cover-${uniqueId}.webp`;
    }
    // For uploads before article creation
    const timestamp = Date.now();
    return `articles/covers/${timestamp}-${uniqueId}.webp`;
};

/**
 * Generate S3 key for article figure images
 * Format: article-{articleId}/figure-{sectionId}-{shortUuid}.webp
 * If IDs not provided, uses: articles/figures/{timestamp}-{shortUuid}.webp
 */
const generateArticleFigureKey = (articleId = null, sectionId = null) => {
    const uniqueId = shortUuid();
    if (articleId && sectionId) {
        return `article-${articleId}/figure-${sectionId}-${uniqueId}.webp`;
    }
    // For uploads before article/section creation
    const timestamp = Date.now();
    return `articles/figures/${timestamp}-${uniqueId}.webp`;
};

/**
 * Generate S3 key for announcement files
 * Format: announcement-{announcementId}/file-{timestamp}-{shortUuid}.webp
 */
const generateAnnouncementKey = (announcementId) => {
    const timestamp = Date.now();
    const uniqueId = shortUuid();
    return `announcement-${announcementId}/file-${timestamp}-${uniqueId}.webp`;
};

module.exports = {
    generatePhotoKey,
    generatePremiumPhotoKey,
    generateArticleCoverKey,
    generateArticleFigureKey,
    generateAnnouncementKey,
    shortUuid
};

