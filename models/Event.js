const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  eventName: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
    maxlength: [200, 'Event name cannot exceed 200 characters']
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    trim: true
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required']
  },
  startTime: {
    type: String,
    trim: true
  },
  endTime: {
    type: String,
    trim: true
  },
  venue: {
    type: String,
    required: [true, 'Venue is required'],
    trim: true,
    maxlength: [500, 'Venue cannot exceed 500 characters']
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  },
  addons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Addon'
  }],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  assignedEmployees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      trim: true
    }
  }],
  assignedEquipment: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment'
  }],
  status: {
    type: String,
    enum: ['Upcoming', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Upcoming'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  
  // Post-event tracking
  deliverables: {
    photosEdited: {
      done: { type: Boolean, default: false },
      date: Date,
      deliveryMethod: String,
      link: String
    },
    videoEdited: {
      done: { type: Boolean, default: false },
      date: Date,
      deliveryMethod: String,
      link: String
    },
    albumDesigned: {
      done: { type: Boolean, default: false },
      date: Date
    },
    albumPrinted: {
      done: { type: Boolean, default: false },
      date: Date
    },
    albumDelivered: {
      done: { type: Boolean, default: false },
      date: Date,
      deliveryMethod: String
    },
    videoDelivered: {
      done: { type: Boolean, default: false },
      date: Date,
      deliveryMethod: String,
      link: String
    },
    photosDelivered: {
      done: { type: Boolean, default: false },
      date: Date,
      deliveryMethod: String,
      link: String
    }
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function() {
  return this.find({ 
    status: 'Upcoming',
    eventDate: { $gte: new Date() }
  })
  .populate('client', 'name phone email')
  .populate('assignedEmployees.user', 'name skills')
  .sort({ eventDate: 1 });
};

// Static method to find events by date range
eventSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    eventDate: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .populate('client', 'name phone')
  .populate('assignedEmployees.user', 'name')
  .sort({ eventDate: 1 });
};

// Static method to find events by status
eventSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('client', 'name phone email')
    .populate('package', 'name basePrice')
    .populate('addons', 'name price')
    .sort({ eventDate: -1 });
};

// Static method to find events by client
eventSchema.statics.findByClient = function(clientId) {
  return this.find({ client: clientId })
    .populate('package', 'name basePrice')
    .populate('addons', 'name price')
    .sort({ eventDate: -1 });
};

// Static method to find today's events
eventSchema.statics.findToday = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    eventDate: {
      $gte: today,
      $lt: tomorrow
    },
    status: { $ne: 'Cancelled' }
  })
  .populate('client', 'name phone')
  .populate('assignedEmployees.user', 'name phone')
  .populate('assignedEquipment', 'name type');
};

// Method to check if employee is assigned
eventSchema.methods.isEmployeeAssigned = function(userId) {
  return this.assignedEmployees.some(emp => emp.user.toString() === userId.toString());
};

// Method to check if equipment is assigned
eventSchema.methods.isEquipmentAssigned = function(equipmentId) {
  return this.assignedEquipment.some(eq => eq.toString() === equipmentId.toString());
};

// Method to mark event as completed
eventSchema.methods.markCompleted = async function() {
  this.status = 'Completed';
  return this.save();
};

// Method to cancel event
eventSchema.methods.cancel = async function() {
  this.status = 'Cancelled';
  return this.save();
};

// Method to calculate deliverable completion percentage
eventSchema.methods.getDeliverableProgress = function() {
  const deliverableKeys = Object.keys(this.deliverables);
  const completed = deliverableKeys.filter(key => this.deliverables[key].done).length;
  return deliverableKeys.length > 0 ? Math.round((completed / deliverableKeys.length) * 100) : 0;
};

// Method to check if all deliverables are completed
eventSchema.methods.areAllDeliverablesCompleted = function() {
  return Object.values(this.deliverables).every(d => d.done);
};

// Virtual for formatted event date
eventSchema.virtual('formattedDate').get(function() {
  return this.eventDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for event summary
eventSchema.virtual('summary').get(function() {
  return {
    id: this._id,
    eventName: this.eventName,
    eventType: this.eventType,
    eventDate: this.eventDate,
    client: this.client,
    status: this.status,
    totalAmount: this.totalAmount,
    assignedEmployeeCount: this.assignedEmployees ? this.assignedEmployees.length : 0,
    assignedEquipmentCount: this.assignedEquipment ? this.assignedEquipment.length : 0
  };
});

// Virtual to check if event is upcoming soon (within 24 hours)
eventSchema.virtual('isUpcomingSoon').get(function() {
  if (this.status !== 'Upcoming') return false;
  const now = new Date();
  const eventTime = new Date(this.eventDate);
  const hoursDiff = (eventTime - now) / (1000 * 60 * 60);
  return hoursDiff > 0 && hoursDiff <= 24;
});

// Virtual to check if event is overdue for deliverables
eventSchema.virtual('isDeliverableOverdue').get(function() {
  if (this.status !== 'Completed') return false;
  const now = new Date();
  const eventTime = new Date(this.eventDate);
  const daysSinceEvent = (now - eventTime) / (1000 * 60 * 60 * 24);
  // Consider overdue if more than 30 days and not all deliverables completed
  return daysSinceEvent > 30 && !this.areAllDeliverablesCompleted();
});

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// Create indexes for efficient queries
eventSchema.index({ client: 1 });
eventSchema.index({ eventDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ 'assignedEmployees.user': 1 });
eventSchema.index({ 'assignedEquipment': 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ eventDate: 1, status: 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
