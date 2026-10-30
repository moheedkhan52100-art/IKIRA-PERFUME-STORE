import { z } from 'zod'

const slugSchema = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const adminProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  family: z.string().trim().min(1).max(60),
  gender: z.enum(['men', 'women', 'unisex']).optional(),
  category: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  concentration: z.string().trim().min(1).max(60),
  price: z.coerce.number().finite().min(0).max(10000000),
  sizes: z.array(z.string().trim().min(1).max(20)).min(1).max(8),
  stock: z.coerce.number().int().min(0).max(100000),
  description: z.string().trim().min(1).max(2000),
  notes: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
  collection: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict()
  .refine(({ sizes }) => new Set(sizes.map((size) => size.toLowerCase())).size === sizes.length, {
    message: 'Product sizes must be unique.',
    path: ['sizes'],
  })
  .refine(({ gender, category }) => gender || category, {
    message: 'Choose a product category.',
    path: ['category'],
  })

export const adminProductSlugSchema = slugSchema
export const adminProductVisibilitySchema = z.object({ published: z.boolean() }).strict()

export const adminProductInventorySchema = z.object({
  variants: z.array(z.object({
    sku: z.string().trim().min(1).max(100).optional(),
    size: z.string().trim().min(1).max(20).optional(),
    stock: z.coerce.number().int().min(0).max(100000),
    price: z.coerce.number().finite().min(0).max(10000000).optional(),
  }).strict()).min(1).max(8),
  available: z.boolean(),
  gender: z.enum(['men', 'women', 'unisex']).optional(),
  category: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  family: z.string().trim().min(1).max(60).optional(),
  concentration: z.string().trim().min(1).max(60).optional(),
  sizes: z.array(z.string().trim().min(1).max(20)).min(1).max(8).optional(),
  price: z.coerce.number().finite().min(0).max(10000000).optional(),
  collection: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
}).strict()
  .refine(({ variants }) => variants.every(({ sku, size }) => sku || size), {
    message: 'Each variant needs a SKU or size.',
    path: ['variants'],
  })
  .refine(({ variants }) => {
    const skus = variants.flatMap(({ sku }) => (sku ? [sku] : []))
    const sizes = variants.flatMap(({ size }) => (size ? [size.toLowerCase()] : []))
    return new Set(skus).size === skus.length && new Set(sizes).size === sizes.length
  }, {
    message: 'Product SKUs must be unique.',
    path: ['variants'],
  })
  .refine(({ sizes }) => !sizes || new Set(sizes.map((size) => size.toLowerCase())).size === sizes.length, {
    message: 'Product sizes must be unique.',
    path: ['variants'],
  })
  .refine(({ price, variants }) => (
    price !== undefined || variants.every(({ price: variantPrice }) => variantPrice !== undefined)
  ), {
    message: 'Provide a price for every variant.',
    path: ['variants'],
  })
