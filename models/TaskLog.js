const mongoose = require('mongoose');

const taskLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  taskType: {
    type: String,
    enum: ['Photo Shoot', 'Video Shoot', 'Photo Editing', 'Video Editing', 'Album Design', 'Delivery', 'Other'],
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  hoursSpent: {
    type: Number,
    required: true,
    min: 0.25,
    max: 24
  },
  date: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
taskLogSchema.index({ user: 1, date: -1 });
taskLogSchema.index({ event: 1 });
taskLogSchema.index({ client: 1 });
taskLogSchema.index({ date: -1 });
taskLogSchema.index({ taskType: 1 });

// Static method to get task summary for a user within a date range
taskLogSchema.statics.getUserSummary = async function(userId, startDate, endDate) {
  const tasks = await this.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate }
  }).populate('event', 'eventName eventType');

  const summary = {
    totalTasks: tasks.length,
    totalHours: tasks.reduce((sum, t) => sum + t.hoursSpent, 0),
    byTaskType: {}
  };

  // Group by task type
  tasks.forEach(task => {
    if (!summary.byTaskType[task.taskType]) {
      summary.byTaskType[task.taskType] = {
        count: 0,
        hours: 0
      };
    }
    summary.byTaskType[task.taskType].count++;
    summary.byTaskType[task.taskType].hours += task.hoursSpent;
  });

  return summary;
};

// Static method to get task breakdown (events shot, photos edited, etc.)
taskLogSchema.statics.getTaskBreakdown = async function(userId, startDate, endDate) {
  const tasks = await this.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate }
  });

  return {
    eventsShot: tasks.filter(t => t.taskType === 'Photo Shoot' || t.taskType === 'Video Shoot').length,
    photosEdited: tasks.filter(t => t.taskType === 'Photo Editing').length,
    videosEdited: tasks.filter(t => t.taskType === 'Video Editing').length,
    albumsDesigned: tasks.filter(t => t.taskType === 'Album Design').length,
    deliveries: tasks.filter(t => t.taskType === 'Delivery').length,
    otherTasks: tasks.filter(t => t.taskType === 'Other').length,
    totalHours: tasks.reduce((sum, t) => sum + t.hoursSpent, 0)
  };
};

// Check if task log is editable (within 24 hours)
taskLogSchema.methods.isEditable = function() {
  const now = new Date();
  const createdAt = new Date(this.createdAt);
  const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
  return hoursDiff <= 24;
};

// Virtual for checking if edit requires approval
taskLogSchema.virtual('requiresApproval').get(function() {
  return !this.isEditable();
});

module.exports = mongoose.model('TaskLog', taskLogSchema);
