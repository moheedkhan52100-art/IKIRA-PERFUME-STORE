import mongoose from 'mongoose'

const variantSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { _id: false },
)

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    family: { type: String, required: true, trim: true },
    familyKey: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, trim: true, lowercase: true, default: '' },
    gender: { type: String, required: true, enum: ['men', 'women', 'unisex'] },
    concentration: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    sizes: { type: [{ type: String, trim: true }], required: true, validate: (sizes) => sizes.length > 0 },
    rating: { type: Number, required: true, min: 0, max: 5 },
    reviewCount: { type: Number, required: true, min: 0, validate: Number.isInteger },
    available: { type: Boolean, required: true },
    published: { type: Boolean, default: true },
    newArrival: { type: Boolean, required: true, alias: 'isNew' },
    isBestSeller: { type: Boolean, required: true },
    collectionName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      alias: 'collection',
    },
    accent: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true, default: '' },
    galleryImages: { type: [{ type: String, trim: true }], default: [] },
    notes: { type: [{ type: String, trim: true }], required: true, validate: (notes) => notes.length > 0 },
    variants: { type: [variantSchema], required: true, validate: (variants) => variants.length > 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

productSchema.index({ collectionName: 1, available: 1 })

export const Product =
  mongoose.models.Product ?? mongoose.model('Product', productSchema)
