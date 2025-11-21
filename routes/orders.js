const express = require('express');
const router = express.Router();
const { Order, OrderItem, Cart, CartItem, Photo } = require('../models');

// Create order from cart
router.post('/create', async (req, res, next) => {
    try {
        const { cartId, email, userId, paymentIntentId, paymentMethod } = req.body;
        
        if (!cartId || !email) {
            return res.status(400).json({ message: 'cartId and email are required' });
        }
        
        // Get cart with items
        const cart = await Cart.findByPk(cartId);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        
        const cartItems = await CartItem.findAll({
            where: { cartId: cart.id },
            include: [{ model: Photo }]
        });
        
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }
        
        // Calculate total
        const totalAmount = cartItems.reduce((sum, item) => sum + parseFloat(item.price), 0);
        
        // Create order
        const order = await Order.create({
            userId: userId || null,
            email: email,
            totalAmount: totalAmount,
            status: 'pending',
            paymentIntentId: paymentIntentId || null,
            paymentMethod: paymentMethod || null
        });
        
        // Create order items
        const orderItems = await Promise.all(
            cartItems.map(item =>
                OrderItem.create({
                    orderId: order.id,
                    photoId: item.photoId,
                    price: item.price
                })
            )
        );
        
        // Clear cart after order creation
        await CartItem.destroy({ where: { cartId: cart.id } });
        await cart.destroy();
        
        res.json({
            message: 'Order created successfully',
            order: {
                id: order.id,
                totalAmount: order.totalAmount,
                status: order.status,
                items: orderItems
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get order details
router.get('/:orderId', async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { email } = req.query; // For verification
        
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        const orderItems = await OrderItem.findAll({
            where: { orderId: order.id },
            include: [{ model: Photo }]
        });
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Verify email matches (for security)
        if (email && order.email !== email) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        res.json({ 
            order: {
                ...order.toJSON(),
                OrderItems: orderItems
            }
        });
    } catch (error) {
        next(error);
    }
});

// Update order status (webhook from payment provider)
router.post('/webhook', async (req, res, next) => {
    try {
        const { orderId, status, paymentIntentId } = req.body;
        
        if (!orderId || !status) {
            return res.status(400).json({ message: 'orderId and status are required' });
        }
        
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Update order status
        await order.update({
            status: status,
            paymentIntentId: paymentIntentId || order.paymentIntentId
        });
        
        res.json({
            message: 'Order status updated',
            order: {
                id: order.id,
                status: order.status
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get user's orders (by email or userId)
router.get('/', async (req, res, next) => {
    try {
        const { email, userId } = req.query;
        
        if (!email && !userId) {
            return res.status(400).json({ message: 'email or userId is required' });
        }
        
        const where = userId ? { userId } : { email };
        
        const orders = await Order.findAll({
            where: where,
            order: [['createdAt', 'DESC']]
        });
        
        // Get order items for each order
        const ordersWithItems = await Promise.all(
            orders.map(async (order) => {
                const orderItems = await OrderItem.findAll({
                    where: { orderId: order.id },
                    include: [{ model: Photo }]
                });
                return {
                    ...order.toJSON(),
                    OrderItems: orderItems
                };
            })
        );
        
        res.json({ orders: ordersWithItems });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

