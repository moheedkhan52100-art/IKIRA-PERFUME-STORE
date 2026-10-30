import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 60,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    builtIn: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Category =
  mongoose.models.Category ?? mongoose.model('Category', categorySchema)
