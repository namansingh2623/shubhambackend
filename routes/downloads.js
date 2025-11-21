const express = require('express');
const router = express.Router();
const { Order, OrderItem, Photo } = require('../models');
const checkAuth = require('../middleware/check-auth');
const s3 = require('../config/s3');

// Helper to verify purchase
const verifyPurchase = async (photoId, email, userId = null) => {
    const where = userId ? { userId, status: 'paid' } : { email, status: 'paid' };
    
    const orders = await Order.findAll({ where });
    
    if (orders.length === 0) return false;
    
    // Check if any order has this photo
    for (const order of orders) {
        const orderItem = await OrderItem.findOne({
            where: { orderId: order.id, photoId: photoId }
        });
        if (orderItem) return true;
    }
    
    return false;
};

// Download premium image (requires valid purchase)
router.get('/:photoId', async (req, res, next) => {
    try {
        const { photoId } = req.params;
        const { email } = req.query; // For guest users
        const userId = req.user?.id || null; // If authenticated
        
        if (!email && !userId) {
            return res.status(400).json({ message: 'email is required for guest users' });
        }
        
        // Get photo
        const photo = await Photo.findByPk(photoId);
        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }
        
        if (!photo.isPremium || !photo.premiumImageUrl || !photo.premiumStorageId) {
            return res.status(400).json({ message: 'This photo does not have a premium version' });
        }
        
        // Verify purchase
        const hasPurchased = await verifyPurchase(photoId, email, userId);
        if (!hasPurchased) {
            return res.status(403).json({ message: 'You have not purchased this image' });
        }
        
        // Generate signed URL (expires in 1 hour)
        // Premium images are stored in Gallery/album-{albumId}/premium/...
        const params = {
            Bucket: process.env.S3_BUCKET_NAME + '/Gallery',
            Key: photo.premiumStorageId,
            Expires: 3600 // 1 hour
        };
        
        const signedUrl = s3.getSignedUrl('getObject', params);
        
        // Update download status in order item
        const where = userId ? { userId, status: 'paid' } : { email, status: 'paid' };
        const orders = await Order.findAll({ where });
        
        for (const order of orders) {
            const orderItem = await OrderItem.findOne({
                where: { orderId: order.id, photoId: photoId }
            });
            if (orderItem) {
                await orderItem.update({ downloaded: true });
                break;
            }
        }
        
        res.json({
            downloadUrl: signedUrl,
            expiresIn: 3600, // seconds
            message: 'Download link generated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Get user's purchased images
router.get('/my-purchases/list', async (req, res, next) => {
    try {
        const { email } = req.query; // For guest users
        const userId = req.user?.id || null; // If authenticated
        
        if (!email && !userId) {
            return res.status(400).json({ message: 'email is required for guest users' });
        }
        
        const where = userId ? { userId, status: 'paid' } : { email, status: 'paid' };
        
        const orders = await Order.findAll({
            where: where,
            order: [['createdAt', 'DESC']]
        });
        
        // Flatten to get all purchased photos
        const purchasedPhotos = [];
        for (const order of orders) {
            const orderItems = await OrderItem.findAll({
                where: { orderId: order.id },
                include: [{ model: Photo }]
            });
            
            orderItems.forEach(item => {
                if (item.Photo) {
                    purchasedPhotos.push({
                        orderId: order.id,
                        orderDate: order.createdAt,
                        photo: item.Photo,
                        downloaded: item.downloaded
                    });
                }
            });
        }
        
        res.json({ purchasedPhotos });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

