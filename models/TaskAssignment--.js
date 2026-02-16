const mongoose = require('mongoose');

const taskAssignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned user is required']
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigner is required']
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  dueDate: {
    type: Date,
    default: null
  },
  isVisibleToAssignee: {
    type: Boolean,
    default: false,
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
taskAssignmentSchema.index({ assignedTo: 1, isVisibleToAssignee: 1, status: 1 });
taskAssignmentSchema.index({ assignedBy: 1 });
taskAssignmentSchema.index({ dueDate: 1 });
taskAssignmentSchema.index({ createdAt: -1 });

// Static method to get visible tasks for a user
taskAssignmentSchema.statics.getVisibleTasksForUser = function(userId) {
  return this.find({
    assignedTo: userId,
    isVisibleToAssignee: true,
    status: { $nin: ['Completed', 'Cancelled'] }
  })
  .populate('assignedBy', 'name profilePhoto')
  .sort({ priority: -1, dueDate: 1, createdAt: -1 });
};

// Static method to get all tasks assigned by admin
taskAssignmentSchema.statics.getTasksByAssigner = function(assignerId) {
  return this.find({ assignedBy: assignerId })
    .populate('assignedTo', 'name profilePhoto')
    .sort({ createdAt: -1 });
};

// Method to mark task as completed
taskAssignmentSchema.methods.markCompleted = function() {
  this.status = 'Completed';
  this.completedAt = new Date();
  return this.save();
};

const TaskAssignment = mongoose.model('TaskAssignment', taskAssignmentSchema);

module.exports = TaskAssignment;
