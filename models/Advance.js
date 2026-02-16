const mongoose = require('mongoose');

const advanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true
  },
  deductedInPayroll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Deducted'],
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
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
advanceSchema.index({ user: 1, date: -1 });
advanceSchema.index({ status: 1 });
advanceSchema.index({ deductedInPayroll: 1 });

// Virtual for checking if advance is pending deduction
advanceSchema.virtual('isPendingDeduction').get(function() {
  return this.status === 'Approved' && !this.deductedInPayroll;
});

// Static method to get pending advances for a user
advanceSchema.statics.getPendingAdvances = async function(userId) {
  return this.find({
    user: userId,
    status: 'Approved',
    deductedInPayroll: null
  }).sort({ date: 1 });
};

// Static method to get total pending advance amount for a user
advanceSchema.statics.getTotalPendingAmount = async function(userId) {
  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: 'Approved',
        deductedInPayroll: null
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);
  return result.length > 0 ? result[0].total : 0;
};

// Instance method to approve advance
advanceSchema.methods.approve = async function(approverId) {
  this.status = 'Approved';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to reject advance
advanceSchema.methods.reject = async function(approverId, reason) {
  this.status = 'Rejected';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Instance method to mark as deducted
advanceSchema.methods.markDeducted = async function(payrollId) {
  this.status = 'Deducted';
  this.deductedInPayroll = payrollId;
  return this.save();
};

module.exports = mongoose.model('Advance', advanceSchema);
