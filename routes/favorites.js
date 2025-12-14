import express from 'express';
import Favorite from '../models/Favorite.js';
import Car from '../models/Car.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Add to favorites
router.post('/:carId', authenticate, async (req, res) => {
  try {
    const { carId } = req.params;

    if (!carId) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({
      userId: req.user._id,
      carId
    });

    if (existing) {
      return res.status(400).json({ message: 'Car already in favorites' });
    }

    const favorite = new Favorite({
      userId: req.user._id,
      carId
    });

    await favorite.save();
    res.status(201).json(favorite);
  } catch (error) {
    console.error('❌ Error in POST /api/favorites/:carId:', error);
    console.error('Error stack:', error.stack);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Car already in favorites' });
    }
    
    res.status(500).json({ 
      message: 'Failed to add favorite', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get user's favorites
router.get('/', authenticate, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const favorites = await Favorite.find({ userId: req.user._id })
      .populate('carId')
      .sort({ createdAt: -1 })
      .lean();

    const cars = (favorites || []).map(fav => fav.carId).filter(Boolean);
    res.json(cars);
  } catch (error) {
    console.error('❌ Error in GET /api/favorites:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch favorites', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Remove from favorites
router.delete('/:carId', authenticate, async (req, res) => {
  try {
    const { carId } = req.params;

    if (!carId) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const favorite = await Favorite.findOneAndDelete({
      userId: req.user._id,
      carId
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('❌ Error in DELETE /api/favorites/:carId:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to remove favorite', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;






