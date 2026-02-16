const mongoose = require('mongoose');

const equipmentCheckoutSchema = new mongoose.Schema({
  equipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment',
    required: [true, 'Equipment is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: false
  },
  checkoutDate: {
    type: Date,
    required: [true, 'Checkout date is required'],
    default: Date.now
  },
  expectedReturn: {
    type: Date,
    required: false
  },
  returnDate: {
    type: Date,
    default: null
  },
  returnNotes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Checked Out', 'Returned', 'Overdue'],
    default: 'Checked Out'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
equipmentCheckoutSchema.index({ equipment: 1, status: 1 });
equipmentCheckoutSchema.index({ user: 1, status: 1 });
equipmentCheckoutSchema.index({ event: 1 });
equipmentCheckoutSchema.index({ checkoutDate: 1 });
equipmentCheckoutSchema.index({ expectedReturn: 1, status: 1 });

// Virtual to check if checkout is overdue
equipmentCheckoutSchema.virtual('isOverdue').get(function() {
  if (this.status === 'Returned') {
    return false;
  }
  
  if (this.expectedReturn) {
    return new Date() > this.expectedReturn;
  }
  
  return false;
});

// Virtual to calculate days overdue
equipmentCheckoutSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) {
    return 0;
  }
  
  const now = new Date();
  const diffTime = Math.abs(now - this.expectedReturn);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware to update status based on dates
equipmentCheckoutSchema.pre('save', function(next) {
  // If equipment is being returned, set status to Returned
  if (this.returnDate && this.status !== 'Returned') {
    this.status = 'Returned';
  }
  
  // If not returned and past expected return date, mark as Overdue
  if (!this.returnDate && this.expectedReturn && new Date() > this.expectedReturn) {
    this.status = 'Overdue';
  }
  
  next();
});

// Method to mark equipment as returned
equipmentCheckoutSchema.methods.markReturned = function(notes) {
  this.returnDate = new Date();
  this.returnNotes = notes || '';
  this.status = 'Returned';
  return this.save();
};

// Method to extend expected return date
equipmentCheckoutSchema.methods.extendReturn = function(newDate) {
  this.expectedReturn = newDate;
  // Reset status to Checked Out if it was Overdue
  if (this.status === 'Overdue') {
    this.status = 'Checked Out';
  }
  return this.save();
};

// Static method to find active checkouts for a user
equipmentCheckoutSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    user: userId,
    status: { $in: ['Checked Out', 'Overdue'] }
  }).populate('equipment event');
};

// Static method to find active checkouts for equipment
equipmentCheckoutSchema.statics.findActiveByEquipment = function(equipmentId) {
  return this.findOne({
    equipment: equipmentId,
    status: { $in: ['Checked Out', 'Overdue'] }
  }).populate('user event');
};

// Static method to find overdue checkouts
equipmentCheckoutSchema.statics.findOverdue = function() {
  return this.find({
    status: { $in: ['Checked Out', 'Overdue'] },
    expectedReturn: { $lt: new Date() }
  }).populate('equipment user event');
};

// Static method to find checkouts for an event
equipmentCheckoutSchema.statics.findByEvent = function(eventId) {
  return this.find({
    event: eventId
  }).populate('equipment user');
};

module.exports = mongoose.model('EquipmentCheckout', equipmentCheckoutSchema);
