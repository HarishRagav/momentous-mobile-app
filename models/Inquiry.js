const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  venue: {
    type: String,
    trim: true
  },
  packageConfirmed: {
    type: String,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  familyMembers: {
    bride: {
      father: { type: String, trim: true },
      mother: { type: String, trim: true },
      sister: { type: String, trim: true }
    },
    groom: {
      father: { type: String, trim: true },
      mother: { type: String, trim: true },
      brother: { type: String, trim: true }
    }
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: ['Walk-in', 'Phone', 'Instagram', 'Referral', 'Website', 'Facebook', 'Other'],
    default: 'Walk-in'
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    trim: true
  },
  eventDate: {
    type: Date
  },
  requirements: {
    type: String,
    trim: true,
    maxlength: [2000, 'Requirements cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Negotiating', 'Converted', 'Rejected', 'Unresponsive'],
    default: 'New'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastContactDate: {
    type: Date,
    default: null
  },
  nextFollowUp: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Negotiating', 'Converted', 'Rejected', 'Unresponsive'],
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  convertedToClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  convertedToEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Static method to check for duplicates by phone or email
inquirySchema.statics.checkDuplicate = async function (phone, email, excludeId = null) {
  const query = [];
  if (phone) query.push({ phone });
  if (email) query.push({ email });

  if (query.length === 0) return null;

  const filter = { $or: query };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return this.findOne(filter);
};

// Static method to find inquiries needing follow-up
inquirySchema.statics.findNeedingFollowUp = async function (daysThreshold = 3) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

  return this.find({
    status: { $in: ['New', 'Contacted', 'Negotiating'] },
    $or: [
      { lastContactDate: { $lt: thresholdDate } },
      { lastContactDate: null, createdAt: { $lt: thresholdDate } }
    ]
  }).populate('assignedTo', 'name email');
};

// Static method to find overdue follow-ups
inquirySchema.statics.findOverdueFollowUps = async function () {
  const now = new Date();
  return this.find({
    status: { $in: ['New', 'Contacted', 'Negotiating'] },
    nextFollowUp: { $lt: now }
  }).populate('assignedTo', 'name email');
};


// Method to update status
inquirySchema.methods.updateStatus = async function (newStatus, userId, notes = '') {
  const validTransitions = {
    'New': ['Contacted', 'Rejected', 'Unresponsive'],
    'Contacted': ['Negotiating', 'Converted', 'Rejected', 'Unresponsive'],
    'Negotiating': ['Converted', 'Rejected', 'Unresponsive'],
    'Converted': [],
    'Rejected': ['New'],
    'Unresponsive': ['New', 'Contacted']
  };

  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }

  const oldStatus = this.status;
  this.status = newStatus;

  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    changedBy: userId,
    changedAt: new Date(),
    notes: notes || `Status changed from ${oldStatus} to ${newStatus}`
  });

  if (newStatus === 'Contacted' || newStatus === 'Negotiating') {
    this.lastContactDate = new Date();
  }

  return this.save();
};

// Method to convert inquiry to client
inquirySchema.methods.markAsConverted = async function (clientId, eventId) {
  this.status = 'Converted';
  this.convertedToClient = clientId;
  this.convertedToEvent = eventId;
  return this.save();
};

// Method to set follow-up date
inquirySchema.methods.setFollowUp = async function (date) {
  this.nextFollowUp = date;
  return this.save();
};

// Virtual to check if follow-up is overdue
inquirySchema.virtual('isFollowUpOverdue').get(function () {
  if (!this.nextFollowUp) return false;
  return new Date() > this.nextFollowUp;
});

// Virtual to check if inquiry is stale (not contacted in X days)
inquirySchema.virtual('isStale').get(function () {
  const staleDays = 3;
  const checkDate = this.lastContactDate || this.createdAt;
  const daysSinceContact = Math.floor((new Date() - checkDate) / (1000 * 60 * 60 * 24));
  return daysSinceContact > staleDays && ['New', 'Contacted', 'Negotiating'].includes(this.status);
});

// Create indexes
inquirySchema.index({ phone: 1 });
inquirySchema.index({ email: 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ source: 1 });
inquirySchema.index({ eventType: 1 });
inquirySchema.index({ assignedTo: 1 });
inquirySchema.index({ nextFollowUp: 1 });
inquirySchema.index({ createdAt: -1 });
inquirySchema.index({ name: 'text', requirements: 'text' });

const Inquiry = mongoose.model('Inquiry', inquirySchema);

module.exports = Inquiry;
