const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const bankDetailsSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  ifscCode: {
    type: String,
    trim: true,
    uppercase: true
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  profilePhoto: {
    type: String,
    default: null
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required']
  },
  skills: [{
    type: String,
    enum: ['Photography', 'Videography', 'Editing', 'Drone', 'Album Design']
  }],
  joiningDate: {
    type: Date,
    default: Date.now
  },
  baseSalary: {
    type: Number,
    default: 0,
    min: [0, 'Salary cannot be negative']
  },
  payroll: {
    payFrequency: {
      type: String,
      enum: ['monthly', 'bi-weekly', 'weekly'],
      default: 'monthly'
    },
    overtimeRate: {
      type: Number,
      default: 0,
      min: [0, 'Overtime rate cannot be negative']
    },
    allowances: [{
      name: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' }
    }],
    deductions: [{
      name: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      type: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' }
    }],
    taxInfo: {
      panNumber: { type: String, trim: true, uppercase: true },
      taxRegime: { type: String, enum: ['old', 'new'], default: 'new' }
    }
  },
  bankDetails: {
    type: bankDetailsSchema,
    default: () => ({})
  },
  workSchedule: {
    startTime: {
      type: String,
      default: '09:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    },
    endTime: {
      type: String,
      default: '18:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    },
    standardHours: {
      type: Number,
      default: 8,
      min: [0, 'Standard hours cannot be negative'],
      max: [24, 'Standard hours cannot exceed 24']
    },
    lateThresholdMinutes: {
      type: Number,
      default: 15,
      min: [0, 'Late threshold cannot be negative']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update lastActive timestamp
userSchema.methods.updateLastActive = async function () {
  this.lastActive = new Date();
  return this.save({ validateBeforeSave: false });
};

// Get user's full profile with role populated
userSchema.methods.getProfile = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Virtual for checking if user has a specific skill
userSchema.methods.hasSkill = function (skill) {
  return this.skills.includes(skill);
};

// Create indexes

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ name: 'text' });

const User = mongoose.model('User', userSchema);

module.exports = User;
