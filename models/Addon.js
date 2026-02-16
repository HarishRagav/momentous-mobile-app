const mongoose = require('mongoose');

const addonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Addon name is required'],
    trim: true,
    maxlength: [100, 'Addon name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
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

// Static method to find active addons
addonSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find addons by IDs
addonSchema.statics.findByIds = function(ids) {
  return this.find({ _id: { $in: ids }, isActive: true });
};

// Static method to calculate total price for multiple addons
addonSchema.statics.calculateTotal = async function(addonIds) {
  const addons = await this.find({ _id: { $in: addonIds } });
  return addons.reduce((total, addon) => total + addon.price, 0);
};

// Method to deactivate addon (soft delete)
addonSchema.methods.deactivate = async function() {
  this.isActive = false;
  return this.save({ validateBeforeSave: false });
};

// Method to activate addon
addonSchema.methods.activate = async function() {
  this.isActive = true;
  return this.save({ validateBeforeSave: false });
};

// Virtual for formatted price
addonSchema.virtual('formattedPrice').get(function() {
  return `₹${this.price.toLocaleString('en-IN')}`;
});

// Ensure virtuals are included in JSON output
addonSchema.set('toJSON', { virtuals: true });
addonSchema.set('toObject', { virtuals: true });

// Create indexes
addonSchema.index({ isActive: 1 });
addonSchema.index({ name: 'text', description: 'text' });
addonSchema.index({ price: 1 });
addonSchema.index({ createdAt: -1 });

const Addon = mongoose.model('Addon', addonSchema);

module.exports = Addon;
