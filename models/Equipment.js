const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Equipment name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Equipment type is required'],
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values
  },
  status: {
    type: String,
    enum: ['Available', 'In Use', 'Maintenance'],
    default: 'Available'
  },
  currentCheckout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EquipmentCheckout',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
equipmentSchema.index({ type: 1, status: 1 });


// Virtual to check if equipment is available
equipmentSchema.virtual('isAvailable').get(function () {
  return this.status === 'Available';
});

// Method to checkout equipment
equipmentSchema.methods.checkout = function (checkoutId) {
  this.status = 'In Use';
  this.currentCheckout = checkoutId;
  return this.save();
};

// Method to return equipment
equipmentSchema.methods.returnEquipment = function () {
  this.status = 'Available';
  this.currentCheckout = null;
  return this.save();
};

// Method to set maintenance status
equipmentSchema.methods.setMaintenance = function () {
  this.status = 'Maintenance';
  this.currentCheckout = null;
  return this.save();
};

module.exports = mongoose.model('Equipment', equipmentSchema);
