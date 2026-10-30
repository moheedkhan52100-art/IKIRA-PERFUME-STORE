import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { Order } from '../models/Order.js'

const retryIntervalMs = 30_000
const maximumBatchSize = 10
const maximumRetryDelayMs = 60 * 60 * 1000
let workerTimer
let processingBatch = false
let transporter

function getTransporter() {
  if (!env.emailConfigured) return null
  transporter ??= nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: {
      user: env.email.user,
      pass: env.email.password,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return transporter
}

export function createOrderNotificationMessage(order) {
  const items = order.items
    .map((item) => (
      `- ${item.productName} (${item.size}, ${item.sku}) x ${item.quantity}: ` +
      `Rs. ${new Intl.NumberFormat('en-PK').format(item.lineTotal)}`
    ))
    .join('\n')
  const customer = order.customer
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.postalCode,
  ].filter(Boolean).join(', ')

  return [
    `A new IKIRA cash-on-delivery order was placed.`,
    `Order: ${order.orderNumber}`,
    `Placed: ${new Date(order.createdAt).toISOString()}`,
    '',
    `Customer: ${customer.fullName}`,
    `Phone: ${customer.phone}`,
    customer.email ? `Email: ${customer.email}` : null,
    `Delivery address: ${address}`,
    '',
    'Items:',
    items,
    '',
    `Subtotal: Rs. ${new Intl.NumberFormat('en-PK').format(order.subtotal)}`,
    'Delivery: Free',
    `Total: Rs. ${new Intl.NumberFormat('en-PK').format(order.total)}`,
    'Payment: Cash on delivery',
  ].filter((line) => line !== null).join('\n')
}

async function deliverNextNotification(options = {}) {
  const {
    orderModel = Order,
    mailTransport = getTransporter(),
    email = env.email,
    now = () => new Date(),
    logError = (message, error) => console.error(message, error),
  } = options
  const hasCustomEmail = Object.hasOwn(options, 'email')
  if (!mailTransport || (!env.emailConfigured && !hasCustomEmail)) return false

  const currentTime = now()
  const order = await orderModel.findOneAndUpdate(
    {
      status: { $ne: 'cancelled' },
      $or: [
        {
          notificationStatus: { $in: ['pending', 'failed'] },
          notificationNextAttemptAt: { $lte: currentTime },
        },
        {
          notificationStatus: 'sending',
          notificationAttemptedAt: {
            $lte: new Date(currentTime.getTime() - 2 * 60 * 1000),
          },
        },
      ],
    },
    {
      $set: {
        notificationStatus: 'sending',
        notificationAttemptedAt: currentTime,
        notificationLastError: '',
      },
      $inc: { notificationAttempts: 1 },
    },
    {
      sort: { notificationNextAttemptAt: 1, createdAt: 1 },
      returnDocument: 'after',
    },
  ).exec()

  if (!order) return false

  try {
    await mailTransport.sendMail({
      from: email.from,
      to: email.storeRecipient,
      subject: `IKIRA order ${order.orderNumber} — COD`,
      text: createOrderNotificationMessage(order),
      messageId: `<${order.orderNumber.toLowerCase()}@ikira.store>`,
    })
    await orderModel.updateOne(
      { _id: order._id, notificationStatus: 'sending' },
      {
        $set: {
          notificationStatus: 'sent',
          notificationSentAt: now(),
          notificationLastError: '',
        },
      },
    ).exec()
  } catch (error) {
    const attempts = order.notificationAttempts
    const retryDelay = Math.min(
      retryIntervalMs * (2 ** Math.max(attempts - 1, 0)),
      maximumRetryDelayMs,
    )
    const reason = String(error.message || 'Email delivery failed').slice(0, 500)
    await orderModel.updateOne(
      { _id: order._id, notificationStatus: 'sending' },
      {
        $set: {
          notificationStatus: 'failed',
          notificationNextAttemptAt: new Date(now().getTime() + retryDelay),
          notificationLastError: reason,
        },
      },
    ).exec()
    logError(`Order email delivery failed for ${order.orderNumber}.`, error)
  }

  return true
}

export async function processPendingOrderNotifications(options = {}) {
  if (processingBatch) return
  processingBatch = true

  try {
    for (let index = 0; index < maximumBatchSize; index += 1) {
      const delivered = await deliverNextNotification(options)
      if (!delivered) break
    }
  } finally {
    processingBatch = false
  }
}

export function startOrderNotificationWorker() {
  if (!env.emailConfigured) {
    console.warn(
      'Order email notifications are not configured. Add the SMTP settings to backend/.env.',
    )
    return () => {}
  }

  if (!workerTimer) {
    workerTimer = setInterval(() => {
      processPendingOrderNotifications().catch((error) => {
        console.error('The order email notification worker could not process its queue.', error)
      })
    }, retryIntervalMs)
    workerTimer.unref()
    processPendingOrderNotifications().catch((error) => {
      console.error('The order email notification worker could not process its queue.', error)
    })
  }

  return () => {
    if (workerTimer) clearInterval(workerTimer)
    workerTimer = undefined
  }
}
