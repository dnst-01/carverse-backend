import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate types
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid field types' });
    }

    // Trim and validate lengths
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || trimmedUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: trimmedEmail.toLowerCase() }, { username: trimmedUsername }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = new User({ 
      username: trimmedUsername, 
      email: trimmedEmail.toLowerCase(), 
      password: trimmedPassword 
    });
    await user.save();

    // Generate token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('⚠️  JWT_SECRET not set, using default (not secure for production)');
    }

    const token = jwt.sign(
      { userId: user._id },
      jwtSecret || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /api/auth/register:', error);
    console.error('Error stack:', error.stack);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }
    
    res.status(500).json({ 
      message: 'Registration failed', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate types
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid field types' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return res.status(400).json({ message: 'Email and password cannot be empty' });
    }

    // Find user
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(trimmedPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('⚠️  JWT_SECRET not set, using default (not secure for production)');
    }

    const token = jwt.sign(
      { userId: user._id },
      jwtSecret || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /api/auth/login:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Login failed', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('❌ Error in GET /api/auth/me:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to get user', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;






