import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Order } from '../models/Order.js'
import {
  createOrderNotificationMessage,
  processPendingOrderNotifications,
} from '../services/orderNotifications.js'

const order = {
  _id: 'order-id',
  orderNumber: 'IK-2026-ABC1234567',
  createdAt: new Date('2026-10-14T08:00:00.000Z'),
  customer: {
    fullName: 'A Customer',
    phone: '+92 300 1234567',
    email: 'customer@example.com',
    addressLine1: '12 Garden Road',
    city: 'Lahore',
  },
  items: [{
    productName: 'Cedar Veil',
    size: '30 ml',
    sku: 'IK-CEDARVEIL-01',
    quantity: 2,
    lineTotal: 29000,
  }],
  subtotal: 29000,
  total: 29000,
  notificationAttempts: 1,
}

test('order notification message contains delivery and COD details', () => {
  const message = createOrderNotificationMessage(order)

  assert.match(message, /IK-2026-ABC1234567/)
  assert.match(message, /A Customer/)
  assert.match(message, /12 Garden Road, Lahore/)
  assert.match(message, /Cedar Veil \(30 ml, IK-CEDARVEIL-01\) x 2/)
  assert.match(message, /Payment: Cash on delivery/)
  assert.doesNotMatch(message, /<script/i)
})

test('new orders are added to the notification retry queue by default', () => {
  const model = new Order({
    orderNumber: 'IK-2026-ABC1234567',
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    customer: {
      fullName: 'A Customer',
      phone: '+92 300 1234567',
      addressLine1: '12 Garden Road',
      city: 'Lahore',
    },
    items: [{
      productSlug: 'cedar-veil',
      productName: 'Cedar Veil',
      sku: 'IK-CEDARVEIL-01',
      size: '30 ml',
      quantity: 1,
      unitPrice: 14500,
      lineTotal: 14500,
    }],
    subtotal: 14500,
    deliveryFee: 0,
    total: 14500,
    currency: 'PKR',
    paymentMethod: 'cash_on_delivery',
    status: 'placed',
  })

  assert.equal(model.notificationStatus, 'pending')
  assert.equal(model.notificationAttempts, 0)
  assert.ok(model.notificationNextAttemptAt instanceof Date)
})

test('notification queue marks successful mail delivery as sent', async () => {
  const sentMessages = []
  const updates = []
  let claimed = false
  const orderModel = {
    findOneAndUpdate(filter, update, options) {
      assert.equal(filter.status.$ne, 'cancelled')
      assert.equal(filter.$or[0].notificationStatus.$in.includes('pending'), true)
      assert.equal(update.$set.notificationStatus, 'sending')
      assert.deepEqual(options.sort, { notificationNextAttemptAt: 1, createdAt: 1 })
      return {
        exec: async () => {
          if (claimed) return null
          claimed = true
          return order
        },
      }
    },
    updateOne(...args) {
      updates.push(args)
      return { exec: async () => ({ modifiedCount: 1 }) }
    },
  }

  await processPendingOrderNotifications({
    orderModel,
    mailTransport: {
      async sendMail(message) {
        sentMessages.push(message)
      },
    },
    email: {
      from: 'IKIRA <orders@ikira.example>',
      storeRecipient: 'store@example.com',
    },
    now: () => new Date('2026-10-14T08:01:00.000Z'),
  })

  assert.equal(sentMessages.length, 1)
  assert.equal(sentMessages[0].to, 'store@example.com')
  assert.match(sentMessages[0].text, /IK-2026-ABC1234567/)
  assert.equal(updates[0][1].$set.notificationStatus, 'sent')
  assert.equal(updates[0][1].$set.notificationSentAt.toISOString(), '2026-10-14T08:01:00.000Z')
})

test('failed notification records the error and schedules an exponential retry', async () => {
  const updates = []
  const loggedErrors = []
  let claimed = false
  const orderModel = {
    findOneAndUpdate() {
      return {
        exec: async () => {
          if (claimed) return null
          claimed = true
          return { ...order, notificationAttempts: 2 }
        },
      }
    },
    updateOne(...args) {
      updates.push(args)
      return { exec: async () => ({ modifiedCount: 1 }) }
    },
  }

  await processPendingOrderNotifications({
    orderModel,
    mailTransport: {
      async sendMail() {
        throw new Error('Temporary SMTP failure')
      },
    },
    email: {
      from: 'IKIRA <orders@ikira.example>',
      storeRecipient: 'store@example.com',
    },
    now: () => new Date('2026-10-14T08:01:00.000Z'),
    logError: (...args) => loggedErrors.push(args),
  })

  assert.equal(updates[0][1].$set.notificationStatus, 'failed')
  assert.equal(updates[0][1].$set.notificationLastError, 'Temporary SMTP failure')
  assert.equal(
    updates[0][1].$set.notificationNextAttemptAt.toISOString(),
    '2026-10-14T08:02:00.000Z',
  )
  assert.equal(loggedErrors.length, 1)
})
