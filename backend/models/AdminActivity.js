import mongoose from 'mongoose'

const adminActivitySchema = new mongoose.Schema(
  {
    actor: { type: String, required: true, trim: true, maxlength: 100 },
    action: { type: String, required: true, trim: true, maxlength: 60 },
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    target: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

adminActivitySchema.index({ createdAt: -1 })

export const AdminActivity =
  mongoose.models.AdminActivity ?? mongoose.model('AdminActivity', adminActivitySchema)
