import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    productSlug: { type: String, required: true, trim: true, lowercase: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    title: { type: String, trim: true, maxlength: 100, default: '' },
    comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  },
  { timestamps: true },
)

reviewSchema.index({ productSlug: 1, customerId: 1 }, { unique: true })
reviewSchema.index({ productSlug: 1, createdAt: -1 })

export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema)
