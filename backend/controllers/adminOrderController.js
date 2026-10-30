import mongoose from 'mongoose'
import { Order } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { recordAdminActivity } from '../utils/recordAdminActivity.js'
import {
  adminOrderQuerySchema,
  adminOrderItemStatusSchema,
  adminOrderStatusSchema,
  orderNumberSchema,
  orderItemSkuSchema,
} from '../validators/adminOrders.js'

const allowedTransitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

function httpError(statusCode, code, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

function invalidRequest(response, code, message, issues) {
  return response.status(400).json({
    error: { code, message, details: issues },
  })
}

export async function listAdminOrders(request, response, next) {
  const parsed = adminOrderQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    return invalidRequest(
      response,
      'INVALID_ORDER_QUERY',
      'Check the order filters and pagination.',
      parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    )
  }

  const { page, limit, status } = parsed.data
  const filter = status
    ? status === 'pending'
      ? { status: { $in: ['placed', 'confirmed'] } }
      : { status }
    : {}

  try {
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      Order.countDocuments(filter).exec(),
    ])
    return response.status(200).json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminOrder(request, response, next) {
  const parsedNumber = orderNumberSchema.safeParse(request.params.orderNumber)
  if (!parsedNumber.success) {
    return invalidRequest(response, 'INVALID_ORDER_NUMBER', 'The order number is invalid.')
  }

  try {
    const order = await Order.findOne({ orderNumber: parsedNumber.data }).lean().exec()
    if (!order) {
      return response.status(404).json({
        error: { code: 'ORDER_NOT_FOUND', message: 'The order could not be found.' },
      })
    }
    order.items = order.items.map((item) => ({ ...item, status: item.status ?? order.status }))
    return response.status(200).json({ data: order })
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminOrderStatus(request, response, next) {
  const parsedNumber = orderNumberSchema.safeParse(request.params.orderNumber)
  if (!parsedNumber.success) {
    return invalidRequest(response, 'INVALID_ORDER_NUMBER', 'The order number is invalid.')
  }

  const parsedStatus = adminOrderStatusSchema.safeParse(request.body)
  if (!parsedStatus.success) {
    return invalidRequest(
      response,
      'INVALID_ORDER_STATUS',
      'Choose a supported next order status.',
      parsedStatus.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    )
  }

  let session
  try {
    session = await mongoose.startSession()
    let updatedOrder
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderNumber: parsedNumber.data }).session(session).exec()
      if (!order) {
        throw httpError(404, 'ORDER_NOT_FOUND', 'The order could not be found.')
      }

      const nextStatus = parsedStatus.data.status
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        throw httpError(
          409,
          'INVALID_ORDER_TRANSITION',
          `An order cannot move from ${order.status} to ${nextStatus}.`,
        )
      }

      if (nextStatus === 'cancelled') {
        if (order.items.some(({ status }) => status === 'shipped' || status === 'delivered')) {
          throw httpError(409, 'ORDER_ITEM_ALREADY_SHIPPED', 'An order with shipped or delivered items cannot be cancelled.')
        }
        for (const item of order.items) {
          const result = await Product.updateOne(
            {
              slug: item.productSlug,
              'variants.sku': item.sku,
            },
            {
              $inc: { 'variants.$.stock': item.quantity },
              $set: { available: true },
            },
            { session },
          ).exec()

          if (result.matchedCount !== 1) {
            throw new Error(`Unable to restore inventory for order ${order.orderNumber}.`)
          }
        }
      }

      order.status = nextStatus
      const statusRank = { placed: 0, confirmed: 1, shipped: 2, delivered: 3 }
      order.items.forEach((item) => {
        if (nextStatus === 'cancelled' || statusRank[item.status ?? order.status] < statusRank[nextStatus]) {
          item.status = nextStatus
        }
      })
      await order.save({ session })
      updatedOrder = order
    })

    await recordAdminActivity(request, {
      action: 'order.status',
      summary: `Order ${updatedOrder.orderNumber} was marked ${updatedOrder.status}.`,
      target: updatedOrder.orderNumber,
    })
    return response.status(200).json({ data: updatedOrder })
  } catch (error) {
    return next(error)
  } finally {
    if (session) await session.endSession()
  }
}

const itemStatusTransitions = {
  placed: ['confirmed'],
  confirmed: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

export async function updateAdminOrderItemStatus(request, response, next) {
  const parsedNumber = orderNumberSchema.safeParse(request.params.orderNumber)
  const parsedSku = orderItemSkuSchema.safeParse(request.params.sku)
  const parsedStatus = adminOrderItemStatusSchema.safeParse(request.body)
  if (!parsedNumber.success || !parsedSku.success || !parsedStatus.success) {
    return invalidRequest(response, 'INVALID_ORDER_ITEM_STATUS', 'Choose a valid order item and next status.')
  }

  let session
  try {
    session = await mongoose.startSession()
    let updatedOrder
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderNumber: parsedNumber.data }).session(session).exec()
      if (!order) throw httpError(404, 'ORDER_NOT_FOUND', 'The order could not be found.')
      if (order.status === 'cancelled') {
        throw httpError(409, 'ORDER_CANCELLED', 'Items in a cancelled order cannot be updated.')
      }

      const item = order.items.find(({ sku }) => sku === parsedSku.data)
      if (!item) throw httpError(404, 'ORDER_ITEM_NOT_FOUND', 'That item could not be found in the order.')
      const currentStatus = item.status ?? order.status
      const nextStatus = parsedStatus.data.status
      if (!itemStatusTransitions[currentStatus]?.includes(nextStatus)) {
        throw httpError(409, 'INVALID_ORDER_ITEM_TRANSITION', `An item cannot move from ${currentStatus} to ${nextStatus}.`)
      }

      item.status = nextStatus
      const statusRank = { placed: 0, confirmed: 1, shipped: 2, delivered: 3 }
      order.status = order.items.reduce((leastAdvanced, orderItem) => {
        const status = orderItem.status ?? order.status
        return statusRank[status] < statusRank[leastAdvanced] ? status : leastAdvanced
      }, 'delivered')
      await order.save({ session })
      updatedOrder = order
    })

    await recordAdminActivity(request, {
      action: 'order.item.status',
      summary: `Item ${parsedSku.data} in ${updatedOrder.orderNumber} was marked ${parsedStatus.data.status}.`,
      target: updatedOrder.orderNumber,
    })
    return response.status(200).json({ data: updatedOrder })
  } catch (error) {
    return next(error)
  } finally {
    if (session) await session.endSession()
  }
}
