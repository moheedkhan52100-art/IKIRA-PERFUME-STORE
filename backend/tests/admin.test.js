import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { test } from 'node:test'
import { createAdminSessionController } from '../controllers/adminAuthController.js'
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminActivity,
  updateAdminProductInventory,
} from '../controllers/adminProductController.js'
import { updateAdminOrderStatus } from '../controllers/adminOrderController.js'
import { env } from '../config/env.js'
import { AdminActivity } from '../models/AdminActivity.js'
import { Category } from '../models/Category.js'
import { Order } from '../models/Order.js'
import { Product } from '../models/Product.js'
import {
  adminCookieName,
  createAdminSession,
  requireAdmin,
} from '../middleware/requireAdmin.js'
import {
  adminOrderQuerySchema,
  adminOrderStatusSchema,
} from '../validators/adminOrders.js'
import {
  adminProductCreateSchema,
  adminProductInventorySchema,
} from '../validators/adminProducts.js'

function createResponse() {
  return {
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
}

test('admin order query validates pagination and status filters', () => {
  assert.deepEqual(
    adminOrderQuerySchema.parse({ page: '2', limit: '10', status: 'confirmed' }),
    { page: 2, limit: 10, status: 'confirmed' },
  )
  assert.equal(adminOrderQuerySchema.parse({ status: 'pending' }).status, 'pending')
  assert.equal(adminOrderQuerySchema.safeParse({ limit: '100' }).success, false)
  assert.equal(adminOrderStatusSchema.safeParse({ status: 'unknown' }).success, false)
})

test('admin product schemas validate create details and complete inventory updates', () => {
  const product = {
    name: 'Cedar Veil',
    family: 'Woody',
    gender: 'unisex',
    concentration: 'Eau de Parfum',
    price: '24500',
    sizes: ['30 ml', '50 ml'],
    stock: '8',
    description: 'Cedar with a warm amber finish.',
    notes: ['Cedar', 'Amber'],
    collection: 'signature',
  }
  assert.equal(adminProductCreateSchema.safeParse(product).success, true)
  assert.equal(
    adminProductCreateSchema.safeParse({ ...product, sizes: ['30 ml', '30 ml'] }).success,
    false,
  )
  assert.equal(
    adminProductInventorySchema.safeParse({
      available: true,
      price: 12500,
      variants: [{ sku: 'CEDAR-30-1', stock: 5 }, { sku: 'CEDAR-50-2', stock: 0 }],
    }).success,
    true,
  )
  assert.equal(
    adminProductInventorySchema.safeParse({
      available: true,
      gender: 'women',
      variants: [
        { sku: 'CEDAR-30-1', stock: 5, price: 12500 },
        { sku: 'CEDAR-50-2', stock: 0, price: 19500 },
      ],
    }).success,
    true,
  )
  assert.equal(
    adminProductInventorySchema.safeParse({
      available: true,
      variants: [{ sku: 'CEDAR-30-1', stock: 5 }],
    }).success,
    false,
  )
  assert.equal(
    adminProductInventorySchema.safeParse({
      available: true,
      variants: [{ sku: 'CEDAR-30-1', stock: -1 }],
    }).success,
    false,
  )
})

test('admin product edits save independent variant prices and product category', async (context) => {
  const product = {
    slug: 'cedar-veil',
    name: 'Cedar Veil',
    gender: 'unisex',
    price: 24000,
    available: true,
    collectionName: 'signature',
    variants: [
      { sku: 'CEDAR-30-1', size: '30 ml', stock: 5, price: 24000 },
      { sku: 'CEDAR-50-2', size: '50 ml', stock: 3, price: 24000 },
    ],
    async save() {},
  }
  context.mock.method(Product, 'findOne', () => ({ exec: async () => product }))
  context.mock.method(AdminActivity, 'create', async () => [])
  const response = createResponse()
  const errors = []

  await updateAdminProductInventory(
    {
      params: { slug: product.slug },
      admin: { username: 'test-store-admin' },
      body: {
        available: true,
        gender: 'women',
        collection: 'signature',
        variants: [
          { sku: 'CEDAR-30-1', stock: 8, price: 12000 },
          { sku: 'CEDAR-50-2', stock: 4, price: 19000 },
        ],
      },
    },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 200)
  assert.equal(product.gender, 'women')
  assert.equal(product.price, 12000)
  assert.deepEqual(product.variants.map(({ price, stock }) => ({ price, stock })), [
    { price: 12000, stock: 8 },
    { price: 19000, stock: 4 },
  ])
})

test('admin product edits add a new bottle size with its own SKU, price, and stock', async (context) => {
  const product = {
    slug: 'cedar-veil',
    name: 'Cedar Veil',
    family: 'Woody',
    familyKey: 'woody',
    gender: 'unisex',
    concentration: 'Eau de Parfum',
    price: 12000,
    sizes: ['30 ml'],
    available: true,
    collectionName: 'signature',
    variants: [{ sku: 'CEDAR-30-1', size: '30 ml', stock: 5, price: 12000 }],
    async save() {},
  }
  context.mock.method(Product, 'findOne', () => ({ exec: async () => product }))
  context.mock.method(AdminActivity, 'create', async () => [])
  const response = createResponse()
  const errors = []

  await updateAdminProductInventory(
    {
      params: { slug: product.slug },
      admin: { username: 'test-store-admin' },
      body: {
        available: true,
        sizes: ['30 ml', '75 ml'],
        variants: [
          { sku: 'CEDAR-30-1', size: '30 ml', stock: 5, price: 12000 },
          { size: '75 ml', stock: 0, price: 21000 },
        ],
      },
    },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 200)
  assert.deepEqual(product.sizes, ['30 ml', '75 ml'])
  assert.equal(product.variants[1].size, '75 ml')
  assert.equal(product.variants[1].price, 21000)
  assert.equal(product.variants[1].stock, 0)
  assert.match(product.variants[1].sku, /75ML/)
})

test('admin cannot remove a bottle size that still has stock', async (context) => {
  const product = {
    slug: 'cedar-veil',
    name: 'Cedar Veil',
    price: 12000,
    available: true,
    collectionName: 'signature',
    variants: [
      { sku: 'CEDAR-30-1', size: '30 ml', stock: 5, price: 12000 },
      { sku: 'CEDAR-50-2', size: '50 ml', stock: 1, price: 18000 },
    ],
    async save() {
      assert.fail('Should not save while a removed size still has stock')
    },
  }
  context.mock.method(Product, 'findOne', () => ({ exec: async () => product }))
  const response = createResponse()
  const errors = []

  await updateAdminProductInventory(
    {
      params: { slug: product.slug },
      body: {
        available: true,
        sizes: ['30 ml'],
        variants: [{ sku: 'CEDAR-30-1', size: '30 ml', stock: 5, price: 12000 }],
      },
    },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 409)
  assert.equal(response.body.error.code, 'SIZE_HAS_STOCK')
})

test('admin activity listing returns the newest stored audit entries', async (context) => {
  const expected = [{ action: 'product.updated', createdAt: new Date() }]
  const query = {
    sort() { return this },
    limit() { return this },
    lean() { return this },
    async exec() { return expected },
  }
  context.mock.method(AdminActivity, 'find', () => query)
  const response = createResponse()
  const errors = []

  await listAdminActivity({}, response, (error) => errors.push(error))

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.data, expected)
})

test('admin can create a named category with a normalized key', async (context) => {
  context.mock.method(Category, 'exists', async () => null)
  context.mock.method(Category, 'create', async (data) => ({ ...data }))
  context.mock.method(AdminActivity, 'create', async () => [])
  const response = createResponse()
  const errors = []

  await createAdminCategory(
    {
      admin: { username: 'test-store-admin' },
      body: { name: 'Bridal Collection' },
    },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 201)
  assert.deepEqual(response.body.data, {
    key: 'bridal-collection',
    name: 'Bridal Collection',
    builtIn: false,
  })
})

test('admin cannot delete a category that still has products assigned', async (context) => {
  context.mock.method(Category, 'findOne', () => ({
    exec: async () => ({ key: 'bridal', name: 'Bridal' }),
  }))
  context.mock.method(Product, 'exists', async () => ({ _id: 'product-id' }))
  const response = createResponse()
  const errors = []

  await deleteAdminCategory(
    { params: { key: 'bridal' } },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 409)
  assert.equal(response.body.error.code, 'CATEGORY_IN_USE')
})

test('admin session rejects invalid, expired, and untrusted-origin credentials', () => {
  const previous = {
    username: env.adminUsername,
    password: env.adminPassword,
    secret: env.adminSessionSecret,
  }
  env.adminUsername = 'test-store-admin'
  env.adminPassword = 'test-password-with-more-than-16-chars'
  env.adminSessionSecret = 'test-session-secret-at-least-32-characters'

  try {
    const acceptedRequest = {
      cookies: { [adminCookieName]: createAdminSession(env.adminUsername) },
      get: () => env.clientOrigins[0],
    }
    let acceptedAdmin = null
    requireAdmin(acceptedRequest, createResponse(), () => {
      acceptedAdmin = acceptedRequest.admin
    })
    assert.deepEqual(acceptedAdmin, { username: env.adminUsername })

    const expiredRequest = {
      cookies: { [adminCookieName]: createAdminSession(env.adminUsername, 0) },
      get: () => env.clientOrigins[0],
    }
    const expiredResponse = createResponse()
    requireAdmin(expiredRequest, expiredResponse, () => assert.fail('Expired session accepted'))
    assert.equal(expiredResponse.statusCode, 401)

    const deniedResponse = createResponse()
    requireAdmin(
      {
        cookies: { [adminCookieName]: createAdminSession(env.adminUsername) },
        get: () => 'https://untrusted.example',
      },
      deniedResponse,
      () => assert.fail('Untrusted origin accepted'),
    )
    assert.equal(deniedResponse.statusCode, 403)
  } finally {
    env.adminUsername = previous.username
    env.adminPassword = previous.password
    env.adminSessionSecret = previous.secret
  }
})

test('admin login issues an httpOnly cookie and records the sign-in', async (context) => {
  const previous = {
    username: env.adminUsername,
    password: env.adminPassword,
    secret: env.adminSessionSecret,
  }
  env.adminUsername = 'test-store-admin'
  env.adminPassword = 'test-password-with-more-than-16-chars'
  env.adminSessionSecret = 'test-session-secret-at-least-32-characters'

  try {
    context.mock.method(AdminActivity, 'create', async () => [])
    const response = createResponse()
    let cookie
    response.cookie = (...args) => {
      cookie = args
      return response
    }

    await createAdminSessionController(
      {
        body: {
          username: env.adminUsername,
          password: env.adminPassword,
        },
      },
      response,
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.username, env.adminUsername)
    assert.equal(response.body.data.password, undefined)
    assert.equal(cookie[0], adminCookieName)
    assert.equal(cookie[2].httpOnly, true)
    assert.equal(cookie[2].sameSite, 'strict')
  } finally {
    env.adminUsername = previous.username
    env.adminPassword = previous.password
    env.adminSessionSecret = previous.secret
  }
})

test('cancelling an admin order restores reserved inventory in the transaction', async (context) => {
  const order = {
    orderNumber: 'IK-2026-ABC1234567',
    status: 'confirmed',
    items: [{ productSlug: 'cedar-veil', sku: 'IK-CEDARVEIL-01', quantity: 2 }],
    async save({ session }) {
      assert.equal(session, transaction)
    },
  }
  let inventoryUpdate
  const transaction = {
    async withTransaction(callback) {
      await callback()
    },
    async endSession() {},
  }
  const orderQuery = {
    session() {
      return this
    },
    async exec() {
      return order
    },
  }
  context.mock.method(Order, 'findOne', () => orderQuery)
  context.mock.method(AdminActivity, 'create', async () => [])
  context.mock.method(Product, 'updateOne', (...args) => {
    inventoryUpdate = args
    return { exec: async () => ({ matchedCount: 1 }) }
  })
  context.mock.method(mongoose, 'startSession', async () => transaction)
  const response = createResponse()
  const errors = []

  await updateAdminOrderStatus(
    {
      params: { orderNumber: order.orderNumber },
      body: { status: 'cancelled' },
    },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 200)
  assert.equal(order.status, 'cancelled')
  assert.deepEqual(inventoryUpdate[0], {
    slug: 'cedar-veil',
    'variants.sku': 'IK-CEDARVEIL-01',
  })
  assert.equal(inventoryUpdate[1].$inc['variants.$.stock'], 2)
  assert.equal(inventoryUpdate[1].$set.available, true)
  assert.equal(inventoryUpdate[2].session, transaction)
})

test('admin order status transitions reject skipped lifecycle states', async (context) => {
  const order = {
    orderNumber: 'IK-2026-ABC1234567',
    status: 'placed',
    items: [],
    async save() {
      assert.fail('Invalid transition must not save the order')
    },
  }
  const transaction = {
    async withTransaction(callback) {
      await callback()
    },
    async endSession() {},
  }
  context.mock.method(Order, 'findOne', () => ({
    session() {
      return this
    },
    async exec() {
      return order
    },
  }))
  context.mock.method(mongoose, 'startSession', async () => transaction)
  const errors = []

  await updateAdminOrderStatus(
    {
      params: { orderNumber: order.orderNumber },
      body: { status: 'delivered' },
    },
    createResponse(),
    (error) => errors.push(error),
  )

  assert.equal(errors[0].code, 'INVALID_ORDER_TRANSITION')
  assert.equal(errors[0].statusCode, 409)
  assert.equal(order.status, 'placed')
})
