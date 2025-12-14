import mongoose from 'mongoose';

/**
 * Production-ready Car Schema for CarVerse
 * Supports comprehensive car data including Indian and Global brands
 * Designed to scale to 1000+ cars with proper indexing
 */
const carSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
      uppercase: true, // Store brands in uppercase for consistency
    },
    model: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    
    // Classification
    bodyType: {
      type: String,
      required: true,
      enum: ['SUV', 'Sedan', 'Hatchback', 'Coupe', 'EV', 'Sports', 'Supercar', 'Convertible', 'Wagon', 'Pickup', 'MPV'],
      index: true,
    },
    fuelType: {
      type: String,
      required: true,
      enum: ['Petrol', 'Diesel', 'EV', 'Hybrid', 'CNG', 'LPG'],
      index: true,
    },
    transmission: {
      type: String,
      required: true,
      enum: ['Manual', 'Automatic', 'DCT', 'CVT', 'AMT'],
      index: true,
    },
    driveType: {
      type: String,
      enum: ['FWD', 'RWD', 'AWD', '4WD'],
      default: 'FWD',
    },
    
    // Engine Specifications
    engine: {
      displacement: {
        type: Number, // in cc (cubic centimeters)
        min: 0,
      },
      cylinders: {
        type: Number,
        min: 0,
        max: 16,
      },
      turbo: {
        type: Boolean,
        default: false,
      },
      aspiration: {
        type: String,
        enum: ['NA', 'Turbo', 'Supercharged', 'Twin-Turbo', 'Electric'],
        default: 'NA',
      },
    },
    
    // Performance
    powerBHP: {
      type: Number,
      min: 0,
      index: true,
    },
    torqueNm: {
      type: Number,
      min: 0,
    },
    topSpeed: {
      type: Number, // in km/h
      min: 0,
    },
    zeroToHundred: {
      type: Number, // in seconds
      min: 0,
    },
    
    // Efficiency
    mileage: {
      type: Number, // km/L for ICE, km for EV
      min: 0,
      index: true,
    },
    range: {
      type: Number, // km (for EVs)
      min: 0,
    },
    
    // Pricing (Indian market - ex-showroom)
    price: {
      min: {
        type: Number, // Minimum price in INR
        min: 0,
        index: true,
      },
      max: {
        type: Number, // Maximum price in INR (for variants)
        min: 0,
        index: true,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    
    // Additional Details
    launchYear: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 2, // Allow future years
      index: true,
    },
    discontinued: {
      type: Boolean,
      default: false,
      index: true,
    },
    safetyRating: {
      type: Number, // NCAP rating (0-5 stars)
      min: 0,
      max: 5,
    },
    seatingCapacity: {
      type: Number,
      min: 2,
      max: 9,
      default: 5,
    },
    
    // Media
    image: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    gallery: [
      {
        type: String,
        trim: true,
      },
    ],
    
    // Features & Content
    keyFeatures: {
      type: [String],
      default: [],
    },
    pros: {
      type: [String],
      default: [],
    },
    cons: {
      type: [String],
      default: [],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    
    // Metadata
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    // Legacy support - keep specs map for backward compatibility
    specs: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: 'browse_cars',
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound indexes for common queries
carSchema.index({ brand: 1, model: 1 }); // Brand + Model lookup
carSchema.index({ bodyType: 1, fuelType: 1 }); // Filter by body and fuel
carSchema.index({ 'price.min': 1, 'price.max': 1 }); // Price range queries
carSchema.index({ launchYear: -1 }); // Sort by launch year
carSchema.index({ powerBHP: -1 }); // Sort by power
carSchema.index({ discontinued: 1, launchYear: -1 }); // Active cars by year
carSchema.index({ brand: 1, discontinued: 1 }); // Brand with status

// Text index for full-text search
carSchema.index({ title: 'text', brand: 'text', model: 'text', tags: 'text' });

// Useful sorting/filter indexes
carSchema.index({ isFeatured: 1 });
carSchema.index({ createdAt: -1 });

// Virtual for average price (useful for sorting/filtering)
carSchema.virtual('avgPrice').get(function() {
  if (this.price?.min && this.price?.max) {
    return (this.price.min + this.price.max) / 2;
  }
  return this.price?.min || this.price?.max || 0;
});

// Ensure virtuals are included in JSON output
carSchema.set('toJSON', { virtuals: true });
carSchema.set('toObject', { virtuals: true });

export default mongoose.model('Car', carSchema, 'browse_cars');


