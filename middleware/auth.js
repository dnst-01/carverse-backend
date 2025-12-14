import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('⚠️  JWT_SECRET not set, using default (not secure for production)');
    }

    const decoded = jwt.verify(token, jwtSecret || 'your-secret-key');
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    res.status(401).json({ message: 'Authentication failed' });
  }
};






