const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Sick', 'Casual', 'Earned'] // Default types, can be extended via settings
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
leaveSchema.index({ user: 1, startDate: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

// Virtual field to calculate number of days
leaveSchema.virtual('numberOfDays').get(function() {
  const diffMs = this.endDate - this.startDate;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  return days;
});

// Ensure virtuals are included in JSON
leaveSchema.set('toJSON', { virtuals: true });
leaveSchema.set('toObject', { virtuals: true });

// Validation: endDate must be >= startDate
leaveSchema.pre('validate', function(next) {
  if (this.endDate < this.startDate) {
    next(new Error('End date must be greater than or equal to start date'));
  } else {
    next();
  }
});

// Method to approve leave
leaveSchema.methods.approve = function(approverId) {
  this.status = 'Approved';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  return this.save();
};

// Method to reject leave
leaveSchema.methods.reject = function(approverId, reason = '') {
  this.status = 'Rejected';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Static method to check for overlapping leaves
leaveSchema.statics.checkOverlap = async function(userId, startDate, endDate, excludeLeaveId = null) {
  const query = {
    user: userId,
    status: { $ne: 'Rejected' },
    $or: [
      // New leave starts during existing leave
      { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
      // New leave ends during existing leave
      { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
      // New leave completely contains existing leave
      { startDate: { $gte: startDate }, endDate: { $lte: endDate } }
    ]
  };

  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  const overlappingLeaves = await this.find(query);
  return overlappingLeaves.length > 0 ? overlappingLeaves : null;
};

// Static method to get leave summary for a user
leaveSchema.statics.getSummary = async function(userId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const leaves = await this.find({
    user: userId,
    status: 'Approved',
    startDate: { $gte: startDate, $lte: endDate }
  });

  const summary = {
    totalLeaves: 0,
    sick: 0,
    casual: 0,
    earned: 0
  };

  leaves.forEach(leave => {
    const days = Math.ceil((leave.endDate - leave.startDate) / (1000 * 60 * 60 * 24)) + 1;
    summary.totalLeaves += days;
    
    if (leave.leaveType === 'Sick') {
      summary.sick += days;
    } else if (leave.leaveType === 'Casual') {
      summary.casual += days;
    } else if (leave.leaveType === 'Earned') {
      summary.earned += days;
    }
  });

  return summary;
};

module.exports = mongoose.model('Leave', leaveSchema);
