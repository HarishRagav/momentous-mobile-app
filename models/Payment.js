const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  paymentType: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: ['Advance', 'Partial', 'Final'],
    trim: true
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    trim: true
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Received by is required']
  },
  receiptNumber: {
    type: String,
    required: [true, 'Receipt number is required'],
    unique: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true
});

// Static method to generate receipt number
paymentSchema.statics.generateReceiptNumber = async function () {
  const year = new Date().getFullYear();
  const lastPayment = await this.findOne({
    receiptNumber: new RegExp(`^RCP${year}`)
  }).sort({ receiptNumber: -1 });

  let nextNumber = 1;
  if (lastPayment && lastPayment.receiptNumber) {
    const lastNumber = parseInt(lastPayment.receiptNumber.slice(-4));
    nextNumber = lastNumber + 1;
  }

  return `RCP${year}${nextNumber.toString().padStart(4, '0')}`;
};

// Static method to find payments by event
paymentSchema.statics.findByEvent = function (eventId) {
  return this.find({ event: eventId })
    .populate('receivedBy', 'name')
    .sort({ paymentDate: -1 });
};

// Static method to find payments by client
paymentSchema.statics.findByClient = function (clientId) {
  return this.find({ client: clientId })
    .populate('event', 'eventName eventDate eventType')
    .populate('receivedBy', 'name')
    .sort({ paymentDate: -1 });
};

// Static method to get total paid for an event
paymentSchema.statics.getTotalPaidForEvent = async function (eventId) {
  const result = await this.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(eventId) } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// Static method to get total paid by a client
paymentSchema.statics.getTotalPaidByClient = async function (clientId) {
  const result = await this.aggregate([
    { $match: { client: new mongoose.Types.ObjectId(clientId) } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// Static method to find pending payments (events with outstanding balance)
paymentSchema.statics.findPendingPayments = async function () {
  const Event = mongoose.model('Event');

  // Get all events with their total amounts
  const events = await Event.find({ status: { $ne: 'Cancelled' } })
    .populate('client', 'name phone email')
    .select('eventName eventDate eventType totalAmount client');

  const pendingPayments = [];

  for (const event of events) {
    const totalPaid = await this.getTotalPaidForEvent(event._id);
    const pending = event.totalAmount - totalPaid;

    if (pending > 0) {
      pendingPayments.push({
        event: event,
        totalAmount: event.totalAmount,
        totalPaid: totalPaid,
        pendingAmount: pending
      });
    }
  }

  return pendingPayments;
};

// Static method to find payments by date range
paymentSchema.statics.findByDateRange = function (startDate, endDate) {
  return this.find({
    paymentDate: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .populate('event', 'eventName eventDate')
    .populate('client', 'name phone')
    .populate('receivedBy', 'name')
    .sort({ paymentDate: -1 });
};

// Static method to get payment summary by method
paymentSchema.statics.getPaymentSummaryByMethod = async function (startDate, endDate) {
  const matchStage = {};
  if (startDate && endDate) {
    matchStage.paymentDate = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$paymentMethod',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

// Virtual for formatted payment date
paymentSchema.virtual('formattedDate').get(function () {
  return this.paymentDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function () {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(this.amount);
});

// Ensure virtuals are included in JSON output
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

// Create indexes for efficient queries
paymentSchema.index({ event: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ paymentDate: -1 });

paymentSchema.index({ receivedBy: 1 });
paymentSchema.index({ paymentType: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
