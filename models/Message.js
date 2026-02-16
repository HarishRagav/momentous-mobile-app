const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'document', 'video', 'audio', 'other'],
    default: 'other'
  },
  size: {
    type: Number
  }
}, { _id: false });

const readReceiptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: [true, 'Chat room is required'],
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  content: {
    type: String,
    trim: true
  },
  attachments: [attachmentSchema],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readBy: [readReceiptSchema],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ mentions: 1 });
messageSchema.index({ 'readBy.user': 1 });

// Validate that message has content or attachments
messageSchema.pre('validate', function(next) {
  if (!this.content && (!this.attachments || this.attachments.length === 0)) {
    this.invalidate('content', 'Message must have content or attachments');
  }
  next();
});

// After saving a message, update the chat room's last activity
messageSchema.post('save', async function(doc) {
  try {
    const ChatRoom = mongoose.model('ChatRoom');
    await ChatRoom.findByIdAndUpdate(doc.room, {
      lastMessage: doc._id,
      lastActivity: doc.createdAt
    });
  } catch (error) {
    console.error('Error updating chat room last activity:', error);
  }
});

// Static method to get messages for a room with pagination
messageSchema.statics.getByRoom = function(roomId, options = {}) {
  const { page = 1, limit = 50, before } = options;
  
  const query = { room: roomId, isDeleted: false };
  
  if (before) {
    query.createdAt = { $lt: before };
  }
  
  return this.find(query)
    .populate('sender', 'name email profilePhoto')
    .populate('mentions', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to search messages
messageSchema.statics.search = function(userId, searchTerm, options = {}) {
  const { roomId, limit = 20 } = options;
  
  const query = {
    content: { $regex: searchTerm, $options: 'i' },
    isDeleted: false
  };
  
  if (roomId) {
    query.room = roomId;
  }
  
  return this.find(query)
    .populate('room')
    .populate('sender', 'name email profilePhoto')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get unread count for a user in a room
messageSchema.statics.getUnreadCount = async function(roomId, userId) {
  return this.countDocuments({
    room: roomId,
    sender: { $ne: userId },
    isDeleted: false,
    'readBy.user': { $ne: userId }
  });
};

// Static method to get messages mentioning a user
messageSchema.statics.getMentions = function(userId, options = {}) {
  const { limit = 20, unreadOnly = false } = options;
  
  const query = {
    mentions: userId,
    isDeleted: false
  };
  
  if (unreadOnly) {
    query['readBy.user'] = { $ne: userId };
  }
  
  return this.find(query)
    .populate('room')
    .populate('sender', 'name email profilePhoto')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to mark as read by a user
messageSchema.methods.markAsRead = async function(userId) {
  const alreadyRead = this.readBy.some(r => r.user.toString() === userId.toString());
  
  if (!alreadyRead) {
    this.readBy.push({ user: userId, readAt: new Date() });
    await this.save();
  }
  
  return this;
};

// Instance method to edit message
messageSchema.methods.editContent = async function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
  return this;
};

// Instance method to soft delete message
messageSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
  return this;
};

// Extract mentions from content (e.g., @username)
messageSchema.statics.extractMentions = function(content) {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  return matches ? matches.map(m => m.substring(1)) : [];
};

module.exports = mongoose.model('Message', messageSchema);
