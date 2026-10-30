import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Product } from '../models/Product.js'

const sampleProduct = {
  slug: 'peachwood',
  name: 'Peachwood',
  family: 'Floral & Woody',
  familyKey: 'floral-woody',
  gender: 'unisex',
  concentration: 'Eau de Parfum',
  price: 24500,
  sizes: ['30 ml', '50 ml'],
  rating: 4.9,
  reviewCount: 42,
  available: true,
  isNew: true,
  isBestSeller: true,
  collection: 'signature',
  accent: 'peach',
  description: 'Peach and magnolia over sunlit woods.',
  notes: ['Peach', 'Magnolia', 'Sandalwood'],
  variants: [{ size: '30 ml', sku: 'IK-PEACHWOOD-01', price: 15500, stock: 22 }],
}

test('product model accepts the current catalog shape', async () => {
  const product = new Product(sampleProduct)

  await assert.doesNotReject(product.validate())
  assert.equal(product.toObject().isNew, true)
  assert.equal(product.toObject().collection, 'signature')
})

test('product model rejects invalid variant stock', async () => {
  const product = new Product({
    ...sampleProduct,
    variants: [{ ...sampleProduct.variants[0], stock: -1 }],
  })

  await assert.rejects(product.validate(), /stock/)
})
