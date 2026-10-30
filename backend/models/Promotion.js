import mongoose from 'mongoose'

const promotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 32 },
    category: { type: String, required: true, enum: ['coupon', 'reward'], default: 'coupon' },
    discountType: { type: String, required: true, enum: ['percent', 'fixed'] },
    discountValue: { type: Number, required: true, min: 1 },
    minimumSubtotal: { type: Number, required: true, min: 0, default: 0 },
    usageLimit: { type: Number, min: 1, default: null },
    usageCount: { type: Number, required: true, min: 0, default: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

promotionSchema.index({ category: 1, active: 1 })

export const Promotion = mongoose.models.Promotion ?? mongoose.model('Promotion', promotionSchema)
