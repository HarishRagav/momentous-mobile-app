const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['Direct', 'Group'],
    required: [true, 'Chat room type is required']
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  linkedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  linkedClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ type: 1 });
chatRoomSchema.index({ lastActivity: -1 });
chatRoomSchema.index({ linkedEvent: 1 });
chatRoomSchema.index({ linkedClient: 1 });

// Validate that group chats have a name
chatRoomSchema.pre('validate', function(next) {
  if (this.type === 'Group' && !this.name) {
    this.invalidate('name', 'Group chats must have a name');
  }
  next();
});

// Validate minimum participants
chatRoomSchema.pre('validate', function(next) {
  if (this.type === 'Direct' && this.participants.length !== 2) {
    this.invalidate('participants', 'Direct chats must have exactly 2 participants');
  }
  if (this.type === 'Group' && this.participants.length < 2) {
    this.invalidate('participants', 'Group chats must have at least 2 participants');
  }
  next();
});

// Static method to find or create a direct chat between two users
chatRoomSchema.statics.findOrCreateDirect = async function(user1Id, user2Id, createdBy) {
  // Check if direct chat already exists between these users
  let room = await this.findOne({
    type: 'Direct',
    participants: { $all: [user1Id, user2Id], $size: 2 }
  });

  if (!room) {
    room = await this.create({
      type: 'Direct',
      participants: [user1Id, user2Id],
      createdBy: createdBy
    });
  }

  return room;
};

// Static method to find rooms by participant
chatRoomSchema.statics.findByParticipant = function(userId) {
  return this.find({ participants: userId })
    .populate('participants', 'name email profilePhoto')
    .populate('lastMessage')
    .populate('linkedEvent', 'eventName eventDate')
    .populate('linkedClient', 'name')
    .sort({ lastActivity: -1 });
};

// Instance method to add participant to group
chatRoomSchema.methods.addParticipant = async function(userId) {
  if (this.type !== 'Group') {
    throw new Error('Cannot add participants to direct chats');
  }
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    await this.save();
  }
  return this;
};

// Instance method to remove participant from group
chatRoomSchema.methods.removeParticipant = async function(userId) {
  if (this.type !== 'Group') {
    throw new Error('Cannot remove participants from direct chats');
  }
  this.participants = this.participants.filter(p => p.toString() !== userId.toString());
  await this.save();
  return this;
};

// Instance method to update last activity
chatRoomSchema.methods.updateLastActivity = async function(messageId) {
  this.lastMessage = messageId;
  this.lastActivity = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
