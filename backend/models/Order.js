import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false },
)

const itemSchema = new mongoose.Schema(
  {
    productSlug: { type: String, required: true, trim: true, lowercase: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    size: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    accountCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
    customer: { type: customerSchema, required: true },
    items: { type: [itemSchema], required: true, validate: (items) => items.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    promotionCode: { type: String, trim: true, uppercase: true },
    discount: { type: Number, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['PKR'], default: 'PKR' },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['cash_on_delivery'],
      default: 'cash_on_delivery',
    },
    status: {
      type: String,
      required: true,
      enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
    notificationStatus: {
      type: String,
      required: true,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    notificationAttempts: { type: Number, required: true, min: 0, default: 0 },
    notificationNextAttemptAt: { type: Date, required: true, default: Date.now },
    notificationAttemptedAt: { type: Date },
    notificationSentAt: { type: Date },
    notificationLastError: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
)

orderSchema.index({ notificationStatus: 1, notificationNextAttemptAt: 1 })

export const Order = mongoose.models.Order ?? mongoose.model('Order', orderSchema)
