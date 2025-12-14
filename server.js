import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import carRoutes from './routes/cars.js';
import reviewRoutes from './routes/reviews.js';
import favoriteRoutes from './routes/favorites.js';
import { ensureSeedData } from './seed/seedMiddleware.js';
import seedRoutes from './routes/seed.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection with proper error handling
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGO_URI is not set in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB Connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
};

// Database connection check middleware
const checkDBConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Database not connected. ReadyState:', mongoose.connection.readyState);
    return res.status(503).json({ 
      message: 'Database connection unavailable. Please try again later.',
      error: 'DATABASE_NOT_CONNECTED'
    });
  }
  next();
};

// Auto-seed in dev when collection is empty (non-blocking)
app.use(ensureSeedData);

// Routes with DB connection check
app.use('/api/auth', checkDBConnection, authRoutes);
app.use('/api/cars', checkDBConnection, carRoutes);
app.use('/api/reviews', checkDBConnection, reviewRoutes);
app.use('/api/favorites', checkDBConnection, favoriteRoutes);
app.use('/api/seed', checkDBConnection, seedRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'OK', 
    message: 'CarVerse API is running',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('Error stack:', err.stack);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server only if not in serverless environment
if (process.env.VERCEL !== '1') {
  // Connect to database first, then start server
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }).catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}

export default app;

