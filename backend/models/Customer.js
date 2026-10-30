import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
)

export const Customer = mongoose.models.Customer ?? mongoose.model('Customer', customerSchema)
