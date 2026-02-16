const mongoose = require('mongoose');

// Stage schema for individual pipeline stages
const stageSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed'],
    default: 'Not Started'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
}, { _id: false });

const pipelineSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required'],
    unique: true
  },
  currentStage: {
    type: String,
    enum: ['Raw Files', 'Culling', 'Photo Editing', 'Video Editing', 'Album Design', 'Quality Check', 'Ready'],
    default: 'Raw Files'
  },
  stages: {
    rawFiles: {
      type: stageSchema,
      default: () => ({ status: 'Not Started' })
    },
    culling: {
      type: stageSchema,
      default: () => ({ status: 'Not Started' })
    },
    photoEditing: {
      type: stageSchema,
      default: () => ({ status: 'Not Started' })
    },
    videoEditing: {
      type: stageSchema,
      default: () => ({ status: 'Not Started' })
    },
    albumDesign: {
      type: stageSchema,
      default: () => ({ status: 'Not Started' })
    },
    qualityCheck: {
      type: stageSchema,
      default: () => ({ status: 'Not Started' })
    }
  },
  // If entire event is assigned to one person
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  },
  // Track when the pipeline was last updated for "stuck" detection
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
pipelineSchema.index({ currentStage: 1 });
pipelineSchema.index({ 'stages.rawFiles.assignedTo': 1 });
pipelineSchema.index({ 'stages.culling.assignedTo': 1 });
pipelineSchema.index({ 'stages.photoEditing.assignedTo': 1 });
pipelineSchema.index({ 'stages.videoEditing.assignedTo': 1 });
pipelineSchema.index({ 'stages.albumDesign.assignedTo': 1 });
pipelineSchema.index({ 'stages.qualityCheck.assignedTo': 1 });
pipelineSchema.index({ assignedTo: 1 });
pipelineSchema.index({ lastUpdatedAt: 1 });

// Map stage names to their schema keys
const stageKeyMap = {
  'Raw Files': 'rawFiles',
  'Culling': 'culling',
  'Photo Editing': 'photoEditing',
  'Video Editing': 'videoEditing',
  'Album Design': 'albumDesign',
  'Quality Check': 'qualityCheck'
};

// Stage order for progression
const stageOrder = ['Raw Files', 'Culling', 'Photo Editing', 'Video Editing', 'Album Design', 'Quality Check', 'Ready'];

// Static method to get stage key from display name
pipelineSchema.statics.getStageKey = function(stageName) {
  return stageKeyMap[stageName] || null;
};

// Static method to get stage order
pipelineSchema.statics.getStageOrder = function() {
  return stageOrder;
};

// Instance method to update a specific stage
pipelineSchema.methods.updateStage = function(stageName, updates) {
  const stageKey = stageKeyMap[stageName];
  if (!stageKey) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }
  
  if (updates.status) {
    this.stages[stageKey].status = updates.status;
    
    if (updates.status === 'In Progress' && !this.stages[stageKey].startedAt) {
      this.stages[stageKey].startedAt = new Date();
    }
    
    if (updates.status === 'Completed') {
      this.stages[stageKey].completedAt = new Date();
    }
  }
  
  if (updates.assignedTo !== undefined) {
    this.stages[stageKey].assignedTo = updates.assignedTo;
  }
  
  this.lastUpdatedAt = new Date();
  
  return this;
};

// Instance method to move to next stage
pipelineSchema.methods.moveToNextStage = function() {
  const currentIndex = stageOrder.indexOf(this.currentStage);
  
  if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) {
    return false; // Already at final stage or invalid
  }
  
  // Mark current stage as completed if not already
  const currentStageKey = stageKeyMap[this.currentStage];
  if (currentStageKey && this.stages[currentStageKey].status !== 'Completed') {
    this.stages[currentStageKey].status = 'Completed';
    this.stages[currentStageKey].completedAt = new Date();
  }
  
  // Move to next stage
  this.currentStage = stageOrder[currentIndex + 1];
  this.lastUpdatedAt = new Date();
  
  return true;
};

// Instance method to check if pipeline is stuck (no update for X days)
pipelineSchema.methods.isStuck = function(daysThreshold = 7) {
  if (this.currentStage === 'Ready') {
    return false; // Completed pipelines are not stuck
  }
  
  const daysSinceUpdate = (Date.now() - this.lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate >= daysThreshold;
};

// Instance method to get progress percentage
pipelineSchema.methods.getProgress = function() {
  const currentIndex = stageOrder.indexOf(this.currentStage);
  if (currentIndex === -1) return 0;
  
  // Ready stage means 100% complete
  if (this.currentStage === 'Ready') return 100;
  
  // Calculate based on completed stages
  let completedStages = 0;
  const totalStages = Object.keys(stageKeyMap).length;
  
  for (const stageKey of Object.values(stageKeyMap)) {
    if (this.stages[stageKey].status === 'Completed') {
      completedStages++;
    }
  }
  
  return Math.round((completedStages / totalStages) * 100);
};

// Virtual to check if pipeline is complete
pipelineSchema.virtual('isComplete').get(function() {
  return this.currentStage === 'Ready';
});

// Ensure virtuals are included in JSON output
pipelineSchema.set('toJSON', { virtuals: true });
pipelineSchema.set('toObject', { virtuals: true });

// Pre-save middleware to update lastUpdatedAt
pipelineSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastUpdatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Pipeline', pipelineSchema);
