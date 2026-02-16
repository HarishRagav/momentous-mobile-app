const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
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
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
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
  referralSource: {
    type: String,
    enum: ['Walk-in', 'Phone', 'Instagram', 'Referral', 'Website', 'Facebook', 'Other'],
    default: 'Walk-in'
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  totalEvents: {
    type: Number,
    default: 0,
    min: [0, 'Total events cannot be negative']
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: [0, 'Total paid cannot be negative']
  },
  totalPending: {
    type: Number,
    default: 0,
    min: [0, 'Total pending cannot be negative']
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  // CRM Fields
  event: String,
  eventDate: Date,
  location: String,
  services: String,
  contactNumber: String,
  preProduction: String,
  milestone: String,
  wishes: String,
  feedbackCall: String,
  addPpNumInGroup: String,
  prTrcShare: String,
  payment: String,
  rawFiles: String,
  // Highlights
  retouched: String,
  teaser: String,
  magazine: String,
  candidVideo: String,
  rawFilesHighlight: String,
  additionalVideo: String,
  album: String,
  prePostWedShoot: String,
  feedbackCall2: String,
  googleReview: String
}, {
  timestamps: true
});


// Static method to find by phone or email (for duplicate detection)
clientSchema.statics.findByPhoneOrEmail = async function (phone, email) {
  const query = [];
  if (phone) query.push({ phone });
  if (email) query.push({ email });

  if (query.length === 0) return null;

  return this.findOne({ $or: query });
};

// Static method to check for duplicates
clientSchema.statics.checkDuplicate = async function (phone, email, excludeId = null) {
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

// Method to update payment totals
clientSchema.methods.updatePaymentTotals = async function (paid, pending) {
  this.totalPaid = paid;
  this.totalPending = pending;
  return this.save({ validateBeforeSave: false });
};

// Method to increment event count
clientSchema.methods.incrementEventCount = async function () {
  this.totalEvents += 1;
  return this.save({ validateBeforeSave: false });
};

// Virtual for full client summary
clientSchema.virtual('summary').get(function () {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    totalEvents: this.totalEvents,
    totalPaid: this.totalPaid,
    totalPending: this.totalPending
  };
});

// Create indexes
clientSchema.index({ phone: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ name: 'text' });
clientSchema.index({ referralSource: 1 });
clientSchema.index({ createdBy: 1 });
clientSchema.index({ createdAt: -1 });

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
