import express from 'express';
import mongoose from 'mongoose';
import Car from '../models/Car.js';
import { authenticate } from '../middleware/auth.js';
import { seedCars } from '../seed/seedCars.js';

const router = express.Router();

/**
 * Sort options mapping
 */
const SORT_FIELDS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  priceAsc: { 'price.min': 1 },
  priceDesc: { 'price.max': -1 },
  powerAsc: { powerBHP: 1 },
  powerDesc: { powerBHP: -1 },
  yearAsc: { launchYear: 1 },
  yearDesc: { launchYear: -1 },
  mileageAsc: { mileage: 1 },
  mileageDesc: { mileage: -1 },
};

const isDev = () =>
  process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_SEED === 'true';

/**
 * Build comparison matrix for multiple cars
 * Returns aligned specifications for easy comparison
 */
const buildComparison = (cars) => {
  const specKeys = [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'bodyType', label: 'Body Type' },
    { key: 'fuelType', label: 'Fuel Type' },
    { key: 'transmission', label: 'Transmission' },
    { key: 'driveType', label: 'Drive Type' },
    { key: 'powerBHP', label: 'Power (BHP)' },
    { key: 'torqueNm', label: 'Torque (Nm)' },
    { key: 'topSpeed', label: 'Top Speed (km/h)' },
    { key: 'zeroToHundred', label: '0-100 km/h (s)' },
    { key: 'mileage', label: 'Mileage (km/L)' },
    { key: 'range', label: 'Range (km)' },
    { key: 'seatingCapacity', label: 'Seating Capacity' },
    { key: 'safetyRating', label: 'Safety Rating' },
    { key: 'launchYear', label: 'Launch Year' },
    { key: 'engine.displacement', label: 'Engine (cc)' },
    { key: 'engine.cylinders', label: 'Cylinders' },
    { key: 'engine.turbo', label: 'Turbo' },
    { key: 'price', label: 'Price (INR)' },
  ];

  const aligned = specKeys.map(({ key, label }) => {
    const values = cars.map((c) => {
      let value = null;
      
      // Handle nested keys
      if (key.includes('.')) {
        const parts = key.split('.');
        value = c[parts[0]]?.[parts[1]] ?? null;
      } else if (key === 'price') {
        // Format price range
        if (c.price?.min && c.price?.max) {
          value = c.price.min === c.price.max 
            ? `₹${c.price.min.toLocaleString('en-IN')}` 
            : `₹${c.price.min.toLocaleString('en-IN')} - ₹${c.price.max.toLocaleString('en-IN')}`;
        } else if (c.price?.min) {
          value = `₹${c.price.min.toLocaleString('en-IN')}`;
        } else if (c.price?.max) {
          value = `₹${c.price.max.toLocaleString('en-IN')}`;
        }
      } else {
        value = c[key] ?? null;
      }
      
      return {
        carId: c._id,
        value: value,
      };
    });
    
    const base = values[0]?.value;
    const differs = values.some((v) => String(v.value) !== String(base));
    
    return { key, label, values, differs };
  });

  return aligned;
};

/**
 * GET /api/cars
 * Get all cars with pagination, filtering, and sorting
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 12, max: 50)
 * - q: Search query (text search)
 * - brand: Filter by brand (case-insensitive)
 * - bodyType: Filter by body type (SUV, Sedan, etc.)
 * - fuelType: Filter by fuel type (Petrol, Diesel, EV, Hybrid)
 * - transmission: Filter by transmission (Manual, Automatic, etc.)
 * - minPrice: Minimum price filter
 * - maxPrice: Maximum price filter
 * - minPower: Minimum power (BHP) filter
 * - launchYear: Filter by launch year
 * - discontinued: Filter discontinued cars (true/false)
 * - tags: Comma-separated tags
 * - sort: Sort option (newest, priceAsc, priceDesc, powerAsc, powerDesc, yearAsc, yearDesc)
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      q,
      brand,
      bodyType,
      fuelType,
      transmission,
      minPrice,
      maxPrice,
      minPower,
      launchYear,
      discontinued,
      tags,
      sort = 'newest',
    } = req.query || {};

    const query = {};
    
    // Text search
    if (q && typeof q === 'string' && q.trim()) {
      query.$text = { $search: q.trim() };
    }
    
    // Brand filter (case-insensitive)
    if (brand && typeof brand === 'string' && brand.trim()) {
      query.brand = { $regex: brand.trim().toUpperCase(), $options: 'i' };
    }
    
    // Body type filter
    if (bodyType && typeof bodyType === 'string') {
      query.bodyType = bodyType.trim();
    }
    
    // Fuel type filter
    if (fuelType && typeof fuelType === 'string') {
      query.fuelType = fuelType.trim();
    }
    
    // Transmission filter
    if (transmission && typeof transmission === 'string') {
      query.transmission = transmission.trim();
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      query.$or = [];
      const min = minPrice ? Number(minPrice) : null;
      const max = maxPrice ? Number(maxPrice) : null;
      
      if (isNaN(min) && min !== null) {
        return res.status(400).json({ message: 'Invalid minPrice value' });
      }
      if (isNaN(max) && max !== null) {
        return res.status(400).json({ message: 'Invalid maxPrice value' });
      }
      
      if (min !== null && max !== null && min > max) {
        return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
      }
      
      if (min !== null && max !== null) {
        query.$or.push(
          { 'price.min': { $gte: min, $lte: max } },
          { 'price.max': { $gte: min, $lte: max } },
          { 
            $and: [
              { 'price.min': { $lte: min } },
              { 'price.max': { $gte: max } }
            ]
          }
        );
      } else if (min !== null) {
        query.$or.push(
          { 'price.max': { $gte: min } },
          { 'price.min': { $gte: min } }
        );
      } else if (max !== null) {
        query.$or.push(
          { 'price.min': { $lte: max } },
          { 'price.max': { $lte: max } }
        );
      }
    }
    
    // Power filter
    if (minPower) {
      const power = Number(minPower);
      if (isNaN(power)) {
        return res.status(400).json({ message: 'Invalid minPower value' });
      }
      query.powerBHP = { $gte: power };
    }
    
    // Launch year filter
    if (launchYear) {
      const year = Number(launchYear);
      if (isNaN(year)) {
        return res.status(400).json({ message: 'Invalid launchYear value' });
      }
      query.launchYear = year;
    }
    
    // Discontinued filter
    if (discontinued !== undefined) {
      query.discontinued = discontinued === 'true' || discontinued === true;
    }
    
    // Tags filter
    if (tags && typeof tags === 'string') {
      const tagArr = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tagArr.length) {
        query.tags = { $in: tagArr };
      }
    }

    const numericLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
    const numericPage = Math.max(Number(page) || 1, 1);

    const sortOption = SORT_FIELDS[sort] || SORT_FIELDS.newest;

    const [data, total] = await Promise.all([
      Car.find(query)
        .sort(sortOption)
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
      Car.countDocuments(query),
    ]);

    res.json({
      data: data || [],
      page: numericPage,
      totalPages: Math.ceil(total / numericLimit),
      total: total || 0,
      limit: numericLimit,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/cars:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch cars', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cars/brands
 * Get all unique brands
 */
router.get('/brands', async (req, res) => {
  try {
    const brands = await Car.distinct('brand');
    res.json({ brands: (brands || []).sort() });
  } catch (error) {
    console.error('❌ Error in GET /api/cars/brands:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch brands', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cars/brand/:brand
 * Get all cars by brand
 */
router.get('/brand/:brand', async (req, res) => {
  try {
    const { brand } = req.params;
    const { page = 1, limit = 12, sort = 'newest' } = req.query || {};
    
    if (!brand || typeof brand !== 'string') {
      return res.status(400).json({ message: 'Brand parameter is required' });
    }
    
    const query = { brand: { $regex: brand.trim().toUpperCase(), $options: 'i' } };
    
    const numericLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
    const numericPage = Math.max(Number(page) || 1, 1);
    const sortOption = SORT_FIELDS[sort] || SORT_FIELDS.newest;
    
    const [data, total] = await Promise.all([
      Car.find(query)
        .sort(sortOption)
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
      Car.countDocuments(query),
    ]);
    
    res.json({
      data: data || [],
      page: numericPage,
      totalPages: Math.ceil((total || 0) / numericLimit),
      total: total || 0,
      brand: brand.trim().toUpperCase(),
    });
  } catch (error) {
    console.error('❌ Error in GET /api/cars/brand/:brand:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch cars by brand', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cars/body-type/:bodyType
 * Get all cars by body type
 */
router.get('/body-type/:bodyType', async (req, res) => {
  try {
    const { bodyType } = req.params;
    const { page = 1, limit = 12, sort = 'newest' } = req.query || {};
    
    if (!bodyType || typeof bodyType !== 'string') {
      return res.status(400).json({ message: 'Body type parameter is required' });
    }
    
    const query = { bodyType: bodyType.trim() };
    
    const numericLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
    const numericPage = Math.max(Number(page) || 1, 1);
    const sortOption = SORT_FIELDS[sort] || SORT_FIELDS.newest;
    
    const [data, total] = await Promise.all([
      Car.find(query)
        .sort(sortOption)
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
      Car.countDocuments(query),
    ]);
    
    res.json({
      data: data || [],
      page: numericPage,
      totalPages: Math.ceil((total || 0) / numericLimit),
      total: total || 0,
      bodyType: bodyType.trim(),
    });
  } catch (error) {
    console.error('❌ Error in GET /api/cars/body-type/:bodyType:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch cars by body type', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cars/search
 * Advanced search endpoint
 * Supports: brand, price range, fuel type, body type, transmission
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      brand,
      bodyType,
      fuelType,
      transmission,
      minPrice,
      maxPrice,
      minPower,
      page = 1,
      limit = 12,
      sort = 'newest',
    } = req.query || {};
    
    const query = {};
    
    // Text search
    if (q && typeof q === 'string' && q.trim()) {
      query.$text = { $search: q.trim() };
    }
    
    if (brand && typeof brand === 'string' && brand.trim()) {
      query.brand = { $regex: brand.trim().toUpperCase(), $options: 'i' };
    }
    
    if (bodyType && typeof bodyType === 'string') {
      query.bodyType = bodyType.trim();
    }
    
    if (fuelType && typeof fuelType === 'string') {
      query.fuelType = fuelType.trim();
    }
    
    if (transmission && typeof transmission === 'string') {
      query.transmission = transmission.trim();
    }
    
    // Price range
    if (minPrice || maxPrice) {
      query.$or = [];
      const min = minPrice ? Number(minPrice) : null;
      const max = maxPrice ? Number(maxPrice) : null;
      
      if (isNaN(min) && min !== null) {
        return res.status(400).json({ message: 'Invalid minPrice value' });
      }
      if (isNaN(max) && max !== null) {
        return res.status(400).json({ message: 'Invalid maxPrice value' });
      }
      
      if (min !== null && max !== null && min > max) {
        return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
      }
      
      if (min !== null && max !== null) {
        query.$or.push(
          { 'price.min': { $gte: min, $lte: max } },
          { 'price.max': { $gte: min, $lte: max } },
          { 
            $and: [
              { 'price.min': { $lte: min } },
              { 'price.max': { $gte: max } }
            ]
          }
        );
      } else if (min !== null) {
        query.$or.push(
          { 'price.max': { $gte: min } },
          { 'price.min': { $gte: min } }
        );
      } else if (max !== null) {
        query.$or.push(
          { 'price.min': { $lte: max } },
          { 'price.max': { $lte: max } }
        );
      }
    }
    
    if (minPower) {
      const power = Number(minPower);
      if (isNaN(power)) {
        return res.status(400).json({ message: 'Invalid minPower value' });
      }
      query.powerBHP = { $gte: power };
    }
    
    const numericLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
    const numericPage = Math.max(Number(page) || 1, 1);
    const sortOption = SORT_FIELDS[sort] || SORT_FIELDS.newest;
    
    const [data, total] = await Promise.all([
      Car.find(query)
        .sort(sortOption)
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
      Car.countDocuments(query),
    ]);
    
    res.json({
      data: data || [],
      page: numericPage,
      totalPages: Math.ceil((total || 0) / numericLimit),
      total: total || 0,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/cars/search:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Search failed', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cars/featured
 * Get featured cars
 */
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit) || 6, 1), 12);
    let featured = await Car.find({ isFeatured: true, discontinued: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Fallback to FEATURED_IDS if no featured cars found
    if (!featured || featured.length === 0) {
      if (process.env.FEATURED_IDS) {
        try {
          const ids = process.env.FEATURED_IDS.split(',').map((id) => id.trim()).filter(Boolean);
          if (ids.length > 0) {
            // Validate ObjectIds
            const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
            if (validIds.length > 0) {
              featured = await Car.find({ _id: { $in: validIds } })
                .limit(limit)
                .lean();
            }
          }
        } catch (envError) {
          console.warn('⚠️  Error parsing FEATURED_IDS:', envError.message);
        }
      }
    }

    res.json(featured || []);
  } catch (error) {
    console.error('❌ Error in GET /api/cars/featured:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch featured cars', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/cars/seed (dev only)
 * Force seed cars - useful for development
 */
router.post('/seed', async (req, res) => {
  if (!isDev()) {
    return res.status(403).json({ message: 'Seeding is disabled outside development' });
  }

  try {
    const result = await seedCars();
    const count = await Car.countDocuments();
    res.json({ 
      message: 'Seed completed', 
      result: result || {},
      totalCars: count || 0
    });
  } catch (error) {
    console.error('❌ Seed error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to seed cars', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/cars/compare
 * Compare up to 4 cars
 * Body: { ids: [id1, id2, id3, id4] }
 */
router.post('/compare', async (req, res) => {
  try {
    const ids = req.body?.ids;
    
    if (!ids) {
      return res.status(400).json({ message: 'Request body must include "ids" array' });
    }

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: '"ids" must be an array' });
    }

    if (ids.length < 2 || ids.length > 4) {
      return res.status(400).json({
        message: 'Provide between 2 and 4 car ids in "ids" array',
      });
    }

    // Validate ObjectIds
    const invalidIds = ids.filter((id) => !id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        message: 'One or more ids are invalid',
        invalidIds 
      });
    }

    // Fetch cars in the order specified
    const cars = await Car.find({ _id: { $in: ids } }).lean();
    const foundIds = cars.map((c) => c._id.toString());
    const missing = ids.filter((id) => !foundIds.includes(id));
    
    if (missing.length) {
      return res.status(404).json({ 
        message: 'Some cars were not found', 
        missing 
      });
    }

    // Maintain order from request
    const orderedCars = ids.map((id) => cars.find((c) => c._id.toString() === id)).filter(Boolean);

    if (orderedCars.length !== ids.length) {
      return res.status(500).json({ message: 'Failed to order cars correctly' });
    }

    const comparison = buildComparison(orderedCars);

    res.json({
      cars: orderedCars,
      comparison,
    });
  } catch (error) {
    console.error('❌ Error in POST /api/cars/compare:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Comparison failed', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/cars/:id
 * Get a single car by ID
 * NOTE: This must be last to avoid conflicts with routes like /brands, /count, etc.
 */
router.get('/:id', async (req, res) => {
  try {
    // Skip if it's a known route (shouldn't happen due to route order, but safety check)
    const knownRoutes = ['brands', 'count', 'featured', 'search', 'seed', 'compare', 'body-type', 'brand'];
    if (knownRoutes.includes(req.params.id)) {
      return res.status(404).json({ message: 'Route not found' });
    }

    const carId = req.params.id;
    if (!carId || typeof carId !== 'string') {
      return res.status(400).json({ message: 'Car ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(carId)) {
      return res.status(400).json({ message: 'Invalid car ID format' });
    }
    
    const car = await Car.findById(carId).lean();
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    res.json(car);
  } catch (error) {
    console.error('❌ Error in GET /api/cars/:id:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to fetch car', 
      detail: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
