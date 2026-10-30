import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productListQuerySchema } from '../validators/productQuery.js'

test('product list query parses supported filters and sorts', () => {
  const result = productListQuerySchema.parse({
    available: 'false',
    category: 'bridal-collection',
    gender: 'unisex',
    maxPrice: '25000',
    page: '2',
    size: '100 ml',
    sort: 'price-asc',
  })

  assert.equal(result.available, false)
  assert.equal(result.category, 'bridal-collection')
  assert.equal(result.page, 2)
  assert.equal(result.maxPrice, 25000)
  assert.equal(result.size, '100 ml')
  assert.equal(result.sort, 'price-asc')
})

test('product list query rejects unsupported filters and inverted price ranges', () => {
  assert.equal(productListQuerySchema.safeParse({ minPrice: '30000', maxPrice: '20000' }).success, false)
  assert.equal(productListQuerySchema.safeParse({ unsupported: 'value' }).success, false)
  assert.equal(productListQuerySchema.safeParse({ category: 'Not a key' }).success, false)
})
