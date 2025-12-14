import mongoose from 'mongoose';
import Car from '../models/Car.js';
import { seedCars } from './seedCars.js';

const isDev = () =>
  process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_SEED === 'true';

let seedPromise = null;
let seedAttempted = false;

export const ensureSeedData = async (req, res, next) => {
  // Only run once on server start
  if (seedAttempted) return next();
  if (!isDev()) {
    seedAttempted = true;
    return next();
  }

  // Prevent multiple simultaneous seed attempts
  if (seedPromise) {
    // Don't wait for seed, just continue with request
    next();
    return;
  }

  seedAttempted = true;
  
  // Start seed process asynchronously (non-blocking)
  seedPromise = (async () => {
    try {
      // Wait for database connection with timeout
      let retries = 0;
      const maxRetries = 10;
      
      while (mongoose.connection.readyState !== 1 && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }

      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️  MongoDB not connected after waiting. Skipping auto-seed.');
        return;
      }

      const count = await Car.countDocuments();
      if (count === 0) {
        console.log('📦 Database is empty. Seeding cars...');
        const result = await seedCars();
        if (result && result.inserted) {
          console.log(`✅ Successfully seeded ${result.inserted} cars`);
        } else if (result && result.skipped) {
          console.log(`ℹ️  Database already has ${result.count} cars. Skipping seed.`);
        } else {
          console.log('ℹ️  Seed completed (no cars inserted)');
        }
      } else {
        console.log(`ℹ️  Database already has ${count} cars. Skipping auto-seed.`);
      }
    } catch (error) {
      console.error('❌ Auto-seed failed:', error.message);
      console.error('Error stack:', error.stack);
      // Don't throw - seed failure shouldn't crash the server
    } finally {
      seedPromise = null;
    }
  })();

  // Don't wait for seed to complete before handling requests
  next();
};





