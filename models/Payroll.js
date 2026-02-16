const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  
  // Base salary from user profile
  baseSalary: {
    type: Number,
    required: [true, 'Base salary is required'],
    min: 0
  },
  
  // Attendance breakdown
  workingDays: {
    type: Number,
    default: 0
  },
  presentDays: {
    type: Number,
    default: 0
  },
  absentDays: {
    type: Number,
    default: 0
  },
  halfDays: {
    type: Number,
    default: 0
  },
  leaveDays: {
    type: Number,
    default: 0
  },
  lateDays: {
    type: Number,
    default: 0
  },
  
  // Overtime
  overtimeHours: {
    type: Number,
    default: 0
  },
  overtimeRate: {
    type: Number,
    default: 0
  },
  overtimePay: {
    type: Number,
    default: 0
  },
  
  // Earnings
  earnings: {
    basic: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  totalEarnings: {
    type: Number,
    default: 0
  },

  // Deductions
  deductions: {
    absence: { type: Number, default: 0 },
    advances: { type: Number, default: 0 },
    latePenalty: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  totalDeductions: {
    type: Number,
    default: 0
  },
  
  // Advances deducted in this payroll
  advancesDeducted: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advance'
  }],
  
  // Net salary
  netSalary: {
    type: Number,
    default: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Approved', 'Paid', 'Cancelled'],
    default: 'Draft'
  },
  
  // Payment details
  paidOn: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', ''],
    default: ''
  },
  transactionRef: {
    type: String,
    trim: true
  },
  
  // Processing info
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for unique payroll per user per month
payrollSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ status: 1 });
payrollSchema.index({ year: 1, month: 1 });


// Virtual for period display
payrollSchema.virtual('period').get(function() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[this.month - 1]} ${this.year}`;
});

// Pre-save hook to calculate totals
payrollSchema.pre('save', function(next) {
  // Calculate total earnings
  this.totalEarnings = (this.earnings.basic || 0) +
                       (this.earnings.overtime || 0) +
                       (this.earnings.bonus || 0) +
                       (this.earnings.allowances || 0) +
                       (this.earnings.other || 0);
  
  // Calculate total deductions
  this.totalDeductions = (this.deductions.absence || 0) +
                         (this.deductions.advances || 0) +
                         (this.deductions.latePenalty || 0) +
                         (this.deductions.tax || 0) +
                         (this.deductions.other || 0);
  
  // Calculate net salary
  this.netSalary = this.totalEarnings - this.totalDeductions;
  
  next();
});

// Static method to get payroll for a specific month/year
payrollSchema.statics.getByMonth = async function(month, year) {
  return this.find({ month, year })
    .populate('user', 'name email')
    .sort({ 'user.name': 1 });
};

// Static method to get user's payroll history
payrollSchema.statics.getUserHistory = async function(userId, limit = 12) {
  return this.find({ user: userId })
    .sort({ year: -1, month: -1 })
    .limit(limit);
};

// Static method to check if payroll exists
payrollSchema.statics.exists = async function(userId, month, year) {
  const count = await this.countDocuments({ user: userId, month, year });
  return count > 0;
};

// Instance method to calculate salary
payrollSchema.methods.calculate = async function(advances) {
  const perDaySalary = this.baseSalary / (this.workingDays || 30);
  
  // Basic salary based on attendance
  const effectiveDays = this.presentDays + this.leaveDays + (this.halfDays * 0.5);
  this.earnings.basic = Math.round(perDaySalary * effectiveDays);
  
  // Overtime pay
  this.earnings.overtime = this.overtimePay;
  
  // Absence deduction
  this.deductions.absence = Math.round(perDaySalary * this.absentDays);
  
  // Advances deduction
  if (advances && advances.length > 0) {
    this.deductions.advances = advances.reduce((sum, adv) => sum + adv.amount, 0);
    this.advancesDeducted = advances.map(adv => adv._id);
  }
  
  return this.save();
};

// Instance method to approve payroll
payrollSchema.methods.approve = async function(approverId) {
  this.status = 'Approved';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to mark as paid
payrollSchema.methods.markPaid = async function(paymentDetails) {
  this.status = 'Paid';
  this.paidOn = paymentDetails.paidOn || new Date();
  this.paymentMethod = paymentDetails.paymentMethod;
  this.transactionRef = paymentDetails.transactionRef;
  return this.save();
};

module.exports = mongoose.model('Payroll', payrollSchema);
