import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { test } from 'node:test'
import { createGuestOrder } from '../controllers/orderController.js'
import { Order } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { createOrderSchema } from '../validators/order.js'

const validOrder = {
  idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
  customer: {
    fullName: 'A Customer',
    phone: '+92 300 1234567',
    email: 'customer@example.com',
    addressLine1: '12 Garden Road',
    city: 'Lahore',
  },
  items: [{
    productId: 'cedar-veil',
    sku: 'ik-cedarveil-01',
    expectedPrice: 14500,
    quantity: 2,
  }],
}

function mockOrderController(context, { product, existingOrder = null }) {
  const calls = {
    create: null,
    productUpdate: null,
    orderUpdate: null,
    sessionEnded: false,
  }
  const session = {
    async withTransaction(callback) {
      await callback()
    },
    async endSession() {
      calls.sessionEnded = true
    },
  }

  context.mock.method(Order, 'init', async () => {})
  context.mock.method(Order, 'findOne', () => ({
    exec: async () => existingOrder,
  }))
  context.mock.method(Order, 'create', async ([orderData]) => {
    calls.create = orderData
    return [{
      ...orderData,
      orderNumber: 'IK-2026-ABC1234567',
      status: 'placed',
    }]
  })
  context.mock.method(Product, 'findOneAndUpdate', () => ({
    exec: async () => product,
  }))
  context.mock.method(Product, 'updateOne', (...args) => {
    calls.productUpdate = args
    return { exec: async () => ({ modifiedCount: 1 }) }
  })
  context.mock.method(mongoose, 'startSession', async () => session)

  return calls
}

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

function createProduct({ price = 14500, stock = 5 } = {}) {
  return {
    _id: 'product-id',
    slug: 'cedar-veil',
    name: 'Cedar Veil',
    variants: [{
      sku: 'IK-CEDARVEIL-01',
      size: '30 ml',
      price,
      stock,
    }],
  }
}

test('guest COD order schema accepts contact, delivery, and variant details', () => {
  const result = createOrderSchema.parse(validOrder)

  assert.equal(result.items[0].sku, 'IK-CEDARVEIL-01')
  assert.equal(result.items[0].quantity, 2)
})

test('guest COD order schema rejects client prices and duplicate variants', () => {
  assert.equal(
    createOrderSchema.safeParse({
      ...validOrder,
      items: [{ ...validOrder.items[0], expectedPrice: 1, price: 1 }],
    }).success,
    false,
  )
  assert.equal(
    createOrderSchema.safeParse({
      ...validOrder,
      items: [validOrder.items[0], validOrder.items[0]],
    }).success,
    false,
  )
})

test('order model accepts a server-priced COD order', async () => {
  const order = new Order({
    orderNumber: 'IK-2026-ABC1234567',
    idempotencyKey: validOrder.idempotencyKey,
    customer: validOrder.customer,
    items: [{
      productSlug: 'cedar-veil',
      productName: 'Cedar Veil',
      sku: 'IK-CEDARVEIL-01',
      expectedPrice: 14500,
      size: '30 ml',
      quantity: 2,
      unitPrice: 14500,
      lineTotal: 29000,
    }],
    subtotal: 29000,
    deliveryFee: 0,
    total: 29000,
    currency: 'PKR',
    paymentMethod: 'cash_on_delivery',
    status: 'placed',
  })

  await assert.doesNotReject(order.validate())
})

test('guest order transaction saves server prices and returns confirmation details', async (context) => {
  const calls = mockOrderController(context, { product: createProduct() })
  const response = createResponse()
  const errors = []

  await createGuestOrder(
    { body: validOrder },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.data.orderNumber, 'IK-2026-ABC1234567')
  assert.equal(response.body.data.total, 29000)
  assert.equal(calls.create.items[0].unitPrice, 14500)
  assert.equal(calls.create.items[0].lineTotal, 29000)
  assert.equal(calls.create.deliveryFee, 0)
  assert.equal(calls.create.paymentMethod, 'cash_on_delivery')
  assert.equal(calls.productUpdate[1].$set.available, true)
  assert.equal(calls.sessionEnded, true)
})

test('guest order transaction rejects stale prices without saving an order', async (context) => {
  const calls = mockOrderController(context, {
    product: createProduct({ price: 15000 }),
  })
  const response = createResponse()
  const errors = []

  await createGuestOrder(
    { body: validOrder },
    response,
    (error) => errors.push(error),
  )

  assert.equal(errors[0].code, 'PRICE_CHANGED')
  assert.equal(errors[0].statusCode, 409)
  assert.equal(calls.create, null)
  assert.equal(calls.productUpdate, null)
  assert.equal(calls.sessionEnded, true)
})

test('guest order transaction rejects unavailable stock without saving an order', async (context) => {
  const calls = mockOrderController(context, { product: null })
  const response = createResponse()
  const errors = []

  await createGuestOrder(
    { body: validOrder },
    response,
    (error) => errors.push(error),
  )

  assert.equal(errors[0].code, 'INVENTORY_UNAVAILABLE')
  assert.equal(errors[0].statusCode, 409)
  assert.equal(calls.create, null)
  assert.equal(calls.productUpdate, null)
  assert.equal(calls.sessionEnded, true)
})

test('guest order retry returns the existing order without opening a transaction', async (context) => {
  const existingOrder = {
    orderNumber: 'IK-2026-EXISTING01',
    customer: { fullName: validOrder.customer.fullName },
    status: 'placed',
    paymentMethod: 'cash_on_delivery',
    subtotal: 29000,
    deliveryFee: 0,
    total: 29000,
    currency: 'PKR',
  }
  const calls = mockOrderController(context, {
    product: createProduct(),
    existingOrder,
  })
  const response = createResponse()
  const errors = []

  await createGuestOrder(
    { body: validOrder },
    response,
    (error) => errors.push(error),
  )

  assert.deepEqual(errors, [])
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.orderNumber, existingOrder.orderNumber)
  assert.equal(calls.create, null)
  assert.equal(calls.sessionEnded, false)
})
