import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  carId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Prevent duplicate reviews from same user for same car
reviewSchema.index({ carId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);






