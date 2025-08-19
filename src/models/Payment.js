import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  provider: {
    type: String,
    default: 'razorpay',
  },
  plan: {
    type: String,
    enum: ['creator', 'pro', 'enterprise'],
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    index: true,
  },
  paymentId: {
    type: String,
    required: true,
    unique: true,
  },
  signature: {
    type: String,
    required: true,
  },
  amountCents: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  status: {
    type: String,
    enum: ['captured', 'failed'],
    default: 'captured',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

PaymentSchema.index({ userId: 1, createdAt: -1 });

const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

export default Payment;