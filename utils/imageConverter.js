const sharp = require('sharp');

/**
 * Convert image buffer to WebP format
 * @param {Buffer} imageBuffer - The image buffer to convert
 * @param {Object} options - Conversion options
 * @param {number} options.quality - WebP quality (1-100, default: 85)
 * @param {number} options.maxWidth - Maximum width (optional, maintains aspect ratio)
 * @param {number} options.maxHeight - Maximum height (optional, maintains aspect ratio)
 * @returns {Promise<Buffer>} - WebP image buffer
 */
async function convertToWebP(imageBuffer, options = {}) {
    try {
        const {
            quality = 85,
            maxWidth = null,
            maxHeight = null
        } = options;

        let sharpInstance = sharp(imageBuffer);

        // Resize if dimensions specified
        if (maxWidth || maxHeight) {
            sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Convert to WebP
        const webpBuffer = await sharpInstance
            .webp({ quality })
            .toBuffer();

        return webpBuffer;
    } catch (error) {
        console.error('Error converting image to WebP:', error);
        throw new Error(`Failed to convert image to WebP: ${error.message}`);
    }
}

/**
 * Check if the image is already in WebP format
 * @param {Buffer} imageBuffer - The image buffer to check
 * @returns {Promise<boolean>} - True if image is WebP
 */
async function isWebP(imageBuffer) {
    try {
        const metadata = await sharp(imageBuffer).metadata();
        return metadata.format === 'webp';
    } catch (error) {
        return false;
    }
}

/**
 * Get image metadata
 * @param {Buffer} imageBuffer - The image buffer
 * @returns {Promise<Object>} - Image metadata
 */
async function getImageMetadata(imageBuffer) {
    try {
        return await sharp(imageBuffer).metadata();
    } catch (error) {
        console.error('Error getting image metadata:', error);
        throw error;
    }
}

module.exports = {
    convertToWebP,
    isWebP,
    getImageMetadata
};

