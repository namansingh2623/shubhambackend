const express = require('express');
const router = express.Router();
const { Cart, CartItem, Photo } = require('../models');

// Helper to get or create cart
const getOrCreateCart = async (sessionId, userId = null) => {
    const where = userId ? { userId } : { sessionId };
    let cart = await Cart.findOne({ where });
    
    if (!cart) {
        cart = await Cart.create({
            sessionId: sessionId,
            userId: userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
    }
    
    return cart;
};

// Add item to cart
router.post('/add', async (req, res, next) => {
    try {
        const { photoId, sessionId, userId } = req.body;
        
        if (!photoId || !sessionId) {
            return res.status(400).json({ message: 'photoId and sessionId are required' });
        }
        
        // Verify photo exists and is premium
        const photo = await Photo.findByPk(photoId);
        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }
        
        if (!photo.isPremium || !photo.premiumImageUrl) {
            return res.status(400).json({ message: 'This photo is not available for purchase' });
        }
        
        // Get or create cart
        const cart = await getOrCreateCart(sessionId, userId);
        
        // Check if item already in cart
        const existingItem = await CartItem.findOne({
            where: { cartId: cart.id, photoId: photoId }
        });
        
        if (existingItem) {
            return res.status(400).json({ message: 'Item already in cart' });
        }
        
        // Add to cart
        const cartItem = await CartItem.create({
            cartId: cart.id,
            photoId: photoId,
            price: photo.price || 0
        });
        
        // Reload cart with items
        const cartItems = await CartItem.findAll({
            where: { cartId: cart.id },
            include: [{ model: Photo }]
        });
        
        const total = cartItems.reduce((sum, item) => sum + parseFloat(item.price), 0);
        
        res.json({
            message: 'Item added to cart',
            cart: {
                id: cart.id,
                items: cartItems,
                total: total
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get cart
router.get('/', async (req, res, next) => {
    try {
        const { sessionId, userId } = req.query;
        
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        
        const where = userId ? { userId } : { sessionId };
        const cart = await Cart.findOne({ where });
        
        if (!cart) {
            return res.json({
                cart: {
                    id: null,
                    items: [],
                    total: 0
                }
            });
        }
        
        const cartItems = await CartItem.findAll({
            where: { cartId: cart.id },
            include: [{ model: Photo }]
        });
        
        const total = cartItems.reduce((sum, item) => sum + parseFloat(item.price), 0);
        
        res.json({
            cart: {
                id: cart.id,
                items: cartItems,
                total: total
            }
        });
    } catch (error) {
        next(error);
    }
});

// Remove item from cart
router.delete('/remove/:itemId', async (req, res, next) => {
    try {
        const itemId = req.params.itemId;
        
        const cartItem = await CartItem.findByPk(itemId);
        if (!cartItem) {
            return res.status(404).json({ message: 'Cart item not found' });
        }
        
        await cartItem.destroy();
        
        res.json({ message: 'Item removed from cart' });
    } catch (error) {
        next(error);
    }
});

// Clear cart
router.delete('/clear', async (req, res, next) => {
    try {
        const { sessionId, userId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }
        
        const cart = await Cart.findOne({
            where: userId ? { userId } : { sessionId }
        });
        
        if (cart) {
            await CartItem.destroy({ where: { cartId: cart.id } });
            await cart.destroy();
        }
        
        res.json({ message: 'Cart cleared' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

