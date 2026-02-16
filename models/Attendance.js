const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  clockIn: {
    type: Date,
    default: null
  },
  clockOut: {
    type: Date,
    default: null
  },
  breaks: [{
    startTime: { type: Date, required: true },
    endTime: Date,
    duration: Number, // in minutes
    reason: { type: String, default: 'Break' }
  }],
  totalBreakTime: {
    type: Number,
    default: 0 // in minutes
  },
  totalHours: {
    type: Number,
    default: 0
  },
  effectiveWorkHours: {
    type: Number,
    default: 0 // totalHours - break time
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Half-day', 'Leave'],
    default: 'Present'
  },
  isLate: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ user: 1 });

// Method to calculate total hours
attendanceSchema.methods.calculateHours = async function() {
  if (this.clockIn && this.clockOut) {
    const diffMs = this.clockOut - this.clockIn;
    const hours = diffMs / (1000 * 60 * 60);
    this.totalHours = Math.round(hours * 100) / 100; // Round to 2 decimal places
    
    // Calculate total break time
    let totalBreakMinutes = 0;
    if (this.breaks && this.breaks.length > 0) {
      this.breaks.forEach(brk => {
        if (brk.endTime) {
          const breakDuration = (brk.endTime - brk.startTime) / (1000 * 60);
          brk.duration = Math.round(breakDuration);
          totalBreakMinutes += brk.duration;
        }
      });
    }
    
    this.totalBreakTime = totalBreakMinutes;
    
    // Calculate effective work hours (total - breaks)
    const effectiveHours = hours - (totalBreakMinutes / 60);
    this.effectiveWorkHours = Math.round(effectiveHours * 100) / 100;
    
    // Get user's standard work hours from their schedule, or fall back to settings
    let standardHours = 8;
    try {
      const User = this.constructor.db.model('User');
      const user = await User.findById(this.user);
      
      if (user && user.workSchedule && user.workSchedule.standardHours) {
        standardHours = user.workSchedule.standardHours;
      } else {
        // Fallback to global settings
        const Settings = this.constructor.db.model('Settings');
        const standardHoursSetting = await Settings.getValue('standard_work_hours');
        if (standardHoursSetting) {
          standardHours = parseFloat(standardHoursSetting);
        }
      }
    } catch (error) {
      console.error('Error fetching standard hours:', error);
    }
    
    // Calculate overtime based on effective hours
    if (this.effectiveWorkHours > standardHours) {
      this.overtimeHours = Math.round((this.effectiveWorkHours - standardHours) * 100) / 100;
    } else {
      this.overtimeHours = 0;
    }
  }
  return this.totalHours;
};

// Pre-save hook to calculate hours automatically
attendanceSchema.pre('save', async function(next) {
  if (this.clockIn && this.clockOut) {
    await this.calculateHours();
  }
  next();
});

// Static method to get attendance summary for a user
attendanceSchema.statics.getSummary = async function(userId, startDate, endDate) {
  const attendances = await this.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate }
  });

  // Get shoot days from TaskLog
  const TaskLog = mongoose.model('TaskLog');
  const shootTasks = await TaskLog.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
    taskType: { $regex: /shoot/i } // Match any task type containing "shoot"
  });

  const summary = {
    totalDays: attendances.length,
    presentDays: attendances.filter(a => a.status === 'Present').length,
    absentDays: attendances.filter(a => a.status === 'Absent').length,
    halfDays: attendances.filter(a => a.status === 'Half-day').length,
    leaveDays: attendances.filter(a => a.status === 'Leave').length,
    lateDays: attendances.filter(a => a.isLate).length,
    totalHours: attendances.reduce((sum, a) => sum + a.totalHours, 0),
    overtimeHours: attendances.reduce((sum, a) => sum + a.overtimeHours, 0),
    shootDays: shootTasks.length // Number of days with shoot tasks
  };

  return summary;
};

// Static method to check if user is late based on settings
attendanceSchema.statics.checkIfLate = function(clockInTime, workStartTime, lateThresholdMinutes = 15) {
  const clockIn = new Date(clockInTime);
  const [hours, minutes] = workStartTime.split(':');
  const startTime = new Date(clockIn);
  startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  const diffMs = clockIn - startTime;
  const diffMinutes = diffMs / (1000 * 60);
  
  console.log('checkIfLate calculation:', {
    clockIn: clockIn.toISOString(),
    workStartTime,
    startTime: startTime.toISOString(),
    diffMinutes,
    lateThresholdMinutes,
    isLate: diffMinutes > lateThresholdMinutes
  });
  
  return diffMinutes > lateThresholdMinutes;
};

module.exports = mongoose.model('Attendance', attendanceSchema);
