import express from 'express';
import Review from '../models/Review.js';
import Car from '../models/Car.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create review
router.post('/:carId', authenticate, async (req, res) => {
  try {
    const { rating, comment } = req.body || {};
    const { carId } = req.params;

    if (!carId) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Check if user already reviewed this car
    const existingReview = await Review.findOne({
      carId,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this car' });
    }

    const review = new Review({
      carId,
      userId: req.user._id,
      rating,
      comment: comment || ''
    });

    await review.save();
    await review.populate('userId', 'username');

    res.status(201).json(review);
  } catch (error) {
    console.error('❌ Error in POST /api/reviews/:carId:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to create review', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get reviews for a car
router.get('/:carId', async (req, res) => {
  try {
    const { carId } = req.params;

    if (!carId) {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    const reviews = await Review.find({ carId })
      .populate('userId', 'username')
      .sort({ date: -1 })
      .lean();

    // Calculate average rating
    const ratings = (reviews || []).map(r => r.rating).filter(r => typeof r === 'number');
    const averageRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : 0;

    res.json({
      reviews: reviews || [],
      averageRating: parseFloat(averageRating) || 0,
      totalReviews: reviews?.length || 0
    });
  } catch (error) {
    console.error('❌ Error in GET /api/reviews/:carId:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch reviews', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;






