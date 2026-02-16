const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Package name is required'],
    trim: true,
    maxlength: [100, 'Package name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    trim: true
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Base price cannot be negative']
  },
  includedItems: [{
    type: String,
    trim: true
  }],
  deliverables: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Static method to find active packages
packageSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ eventType: 1, name: 1 });
};

// Static method to find packages by event type
packageSchema.statics.findByEventType = function(eventType) {
  return this.find({ eventType, isActive: true }).sort({ basePrice: 1 });
};

// Method to deactivate package (soft delete)
packageSchema.methods.deactivate = async function() {
  this.isActive = false;
  return this.save({ validateBeforeSave: false });
};

// Method to activate package
packageSchema.methods.activate = async function() {
  this.isActive = true;
  return this.save({ validateBeforeSave: false });
};

// Virtual for formatted price
packageSchema.virtual('formattedPrice').get(function() {
  return `₹${this.basePrice.toLocaleString('en-IN')}`;
});

// Virtual for package summary
packageSchema.virtual('summary').get(function() {
  return {
    id: this._id,
    name: this.name,
    eventType: this.eventType,
    basePrice: this.basePrice,
    itemCount: this.includedItems.length,
    deliverableCount: this.deliverables.length
  };
});

// Ensure virtuals are included in JSON output
packageSchema.set('toJSON', { virtuals: true });
packageSchema.set('toObject', { virtuals: true });

// Create indexes
packageSchema.index({ eventType: 1 });
packageSchema.index({ isActive: 1 });
packageSchema.index({ name: 'text', description: 'text' });
packageSchema.index({ basePrice: 1 });
packageSchema.index({ createdAt: -1 });

const Package = mongoose.model('Package', packageSchema);

module.exports = Package;
