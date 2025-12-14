import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  carId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Prevent duplicate favorites
favoriteSchema.index({ userId: 1, carId: 1 }, { unique: true });

export default mongoose.model('Favorite', favoriteSchema);






