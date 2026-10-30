import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getProductFilterOptions } from '../controllers/productController.js'
import { Category } from '../models/Category.js'
import { Product } from '../models/Product.js'

test('storefront filter options expose sorted facets from visible products', async (context) => {
  const values = {
    collectionName: ['signature', 'discovery'],
    family: ['Woody', 'Amber'],
    concentration: ['Parfum', 'Eau de Parfum'],
    'variants.size': ['50 ml', '30 ml'],
  }
  const calls = []
  context.mock.method(Product, 'distinct', (field, filter) => {
    calls.push({ field, filter })
    return { exec: async () => values[field] }
  })
  const categoryQuery = {
    sort() { return this },
    lean() { return this },
    async exec() { return [{ key: 'bridal', name: 'Bridal' }] },
  }
  context.mock.method(Category, 'find', () => categoryQuery)
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
  const errors = []

  await getProductFilterOptions({}, response, (error) => errors.push(error))

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.data, {
    collections: ['discovery', 'signature'],
    families: ['Amber', 'Woody'],
    concentrations: ['Eau de Parfum', 'Parfum'],
    sizes: ['30 ml', '50 ml'],
    categories: [
      { key: 'men', name: 'For Him', builtIn: true },
      { key: 'women', name: 'For Her', builtIn: true },
      { key: 'unisex', name: 'Unisex', builtIn: true },
      { key: 'bridal', name: 'Bridal', builtIn: false },
    ],
  })
  assert.equal(calls.length, 4)
  assert.ok(calls.every(({ filter }) => filter.available === true))
})
