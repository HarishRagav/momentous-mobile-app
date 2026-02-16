const mongoose = require('mongoose');

const communicationSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  type: {
    type: String,
    enum: ['Call', 'WhatsApp', 'Email', 'In-Person', 'SMS'],
    required: [true, 'Communication type is required']
  },
  purpose: {
    type: String,
    enum: ['Enquiry', 'Follow-up', 'Negotiation', 'Doubt', 'Complaint'],
    required: [true, 'Purpose is required']
  },
  summary: {
    type: String,
    required: [true, 'Summary is required'],
    trim: true
  },
  duration: {
    type: Number,
    min: 0
  },
  communicatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Communicated by is required']
  },
  followUpNeeded: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  communicationDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
communicationSchema.index({ client: 1, communicationDate: -1 });
communicationSchema.index({ followUpNeeded: 1, followUpDate: 1 });
communicationSchema.index({ communicatedBy: 1 });

module.exports = mongoose.model('Communication', communicationSchema);
