const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['Create', 'Update', 'Delete', 'Login', 'Logout', 'View', 'Export', 'Approve', 'Reject'],
    required: true
  },
  module: {
    type: String,
    enum: [
      'Users', 'Roles', 'Clients', 'Inquiries', 'Events', 
      'Attendance', 'Leaves', 'Payroll', 'Advances', 
      'Equipment', 'Pipeline', 'Payments', 'Packages', 
      'Addons', 'Chat', 'Settings', 'Auth', 'Reports',
      'Communications', 'TaskLogs'
    ],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  targetModel: {
    type: String,
    default: null
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, targetModel: 1 });
auditLogSchema.index({ createdAt: -1 });

// Static method to log an action
auditLogSchema.statics.logAction = async function(data) {
  const { user, action, module, targetId, targetModel, changes, ipAddress, userAgent, description } = data;
  
  return await this.create({
    user,
    action,
    module,
    targetId,
    targetModel,
    changes,
    ipAddress,
    userAgent,
    description
  });
};

// Static method to get activity feed
auditLogSchema.statics.getActivityFeed = async function(options = {}) {
  const { limit = 50, skip = 0, userId, module, action, startDate, endDate } = options;
  
  const query = {};
  
  if (userId) query.user = userId;
  if (module) query.module = module;
  if (action) query.action = action;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return await this.find(query)
    .populate('user', 'name email profilePhoto')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get activity history for a specific record
auditLogSchema.statics.getRecordHistory = async function(targetId, targetModel) {
  return await this.find({ targetId, targetModel })
    .populate('user', 'name email profilePhoto')
    .sort({ createdAt: -1 });
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const { limit = 50, startDate, endDate } = options;
  
  const query = { user: userId };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get activity summary by module
auditLogSchema.statics.getModuleSummary = async function(startDate, endDate) {
  const query = {};
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: { module: '$module', action: '$action' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.module',
        actions: {
          $push: {
            action: '$_id.action',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    { $sort: { totalCount: -1 } }
  ]);
};

// Helper to format changes for display
auditLogSchema.methods.getFormattedChanges = function() {
  if (!this.changes) return [];
  
  const formatted = [];
  for (const [field, change] of Object.entries(this.changes)) {
    formatted.push({
      field,
      oldValue: change.old,
      newValue: change.new
    });
  }
  return formatted;
};

// Virtual for human-readable action description
auditLogSchema.virtual('actionDescription').get(function() {
  const actionVerbs = {
    'Create': 'created',
    'Update': 'updated',
    'Delete': 'deleted',
    'Login': 'logged in',
    'Logout': 'logged out',
    'View': 'viewed',
    'Export': 'exported',
    'Approve': 'approved',
    'Reject': 'rejected'
  };
  
  const verb = actionVerbs[this.action] || this.action.toLowerCase();
  const moduleLabel = this.module.toLowerCase().replace(/s$/, '');
  
  if (this.action === 'Login' || this.action === 'Logout') {
    return verb;
  }
  
  return `${verb} a ${moduleLabel}`;
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
