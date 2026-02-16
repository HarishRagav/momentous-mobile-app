const mongoose = require('mongoose');

/**
 * Notification Model
 * Stores in-app notifications for users
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */
const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: [
      'event_reminder',      // Event scheduled for tomorrow (15.1)
      'payment_overdue',     // Payment overdue (15.2)
      'leave_request',       // Leave request submitted (15.3)
      'leave_approved',      // Leave approved (15.4)
      'leave_rejected',      // Leave rejected (15.4)
      'inquiry_followup',    // Inquiry not contacted in X days (15.5)
      'deliverable_overdue', // Deliverable overdue (15.6)
      'mention',             // User mentioned in chat
      'general'              // General notification
    ]
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  icon: {
    type: String,
    default: 'bell'
  },
  iconColor: {
    type: String,
    default: 'blue'
  },
  link: {
    type: String,
    trim: true
  },
  // Reference to related entity
  relatedModel: {
    type: String,
    enum: ['Event', 'Payment', 'Leave', 'Inquiry', 'Client', 'User', 'ChatRoom', null]
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Mark notification as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return this;
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static method to get notifications for a user
notificationSchema.statics.getForUser = async function(userId, options = {}) {
  const { limit = 20, skip = 0, unreadOnly = false } = options;
  
  const query = { user: userId };
  if (unreadOnly) {
    query.isRead = false;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to delete old notifications (older than 30 days)
notificationSchema.statics.deleteOld = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

// Create indexes
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
