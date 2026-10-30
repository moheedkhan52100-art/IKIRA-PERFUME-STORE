import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'
import { Order } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { Promotion } from '../models/Promotion.js'
import { getPromotionDiscount } from './adminPromotionController.js'
import { processPendingOrderNotifications } from '../services/orderNotifications.js'
import { createOrderSchema } from '../validators/order.js'

function createHttpError(statusCode, code, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

function createOrderNumber() {
  const year = new Date().getFullYear()
  const suffix = randomBytes(5).toString('hex').toUpperCase()
  return `IK-${year}-${suffix}`
}

function orderResponse(order) {
  return {
    data: {
      orderNumber: order.orderNumber,
      customerName: order.customer.fullName,
      status: order.status,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      promotionCode: order.promotionCode,
      discount: order.discount ?? 0,
      deliveryFee: order.deliveryFee,
      total: order.total,
      currency: order.currency,
    },
  }
}

export async function createGuestOrder(request, response, next) {
  const parsedBody = createOrderSchema.safeParse(request.body)

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'INVALID_ORDER',
        message: 'Check the contact, delivery, and item details, then try again.',
        details: parsedBody.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      },
    })
  }

  let session
  let placedOrder

  try {
    await Order.init()
    const existingOrder = await Order.findOne({
      idempotencyKey: parsedBody.data.idempotencyKey,
    }).exec()
    if (existingOrder) return response.status(200).json(orderResponse(existingOrder))

    session = await mongoose.startSession()
    await session.withTransaction(async () => {
      const orderItems = []
      let subtotal = 0

      for (const requestedItem of parsedBody.data.items) {
        const product = await Product.findOneAndUpdate(
          {
            slug: requestedItem.productId,
            available: true,
            published: { $ne: false },
            variants: {
              $elemMatch: {
                sku: requestedItem.sku,
                stock: { $gte: requestedItem.quantity },
              },
            },
          },
          { $inc: { 'variants.$.stock': -requestedItem.quantity } },
          { returnDocument: 'after', session },
        ).exec()

        if (!product) {
          throw createHttpError(
            409,
            'INVENTORY_UNAVAILABLE',
            'One or more items are no longer available in the requested quantity. Update your bag and try again.',
          )
        }

        const variant = product.variants.find((item) => item.sku === requestedItem.sku)
        if (variant.price !== requestedItem.expectedPrice) {
          throw createHttpError(
            409,
            'PRICE_CHANGED',
            `The price for ${product.name} has changed. Review your bag before placing the order.`,
          )
        }

        const lineTotal = variant.price * requestedItem.quantity
        subtotal += lineTotal
        orderItems.push({
          productSlug: product.slug,
          productName: product.name,
          sku: variant.sku,
          size: variant.size,
          quantity: requestedItem.quantity,
          unitPrice: variant.price,
          lineTotal,
          status: 'placed',
        })

        const available = product.variants.some((item) => item.stock > 0)
        await Product.updateOne(
          { _id: product._id },
          { $set: { available } },
          { session },
        ).exec()
      }

      let promotion
      let discount = 0
      if (parsedBody.data.promotionCode) {
        const now = new Date()
        const availability = {
          code: parsedBody.data.promotionCode,
          active: true,
          $and: [
            { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
            { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }] },
            { $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] },
          ],
        }
        promotion = await Promotion.findOne(availability).session(session).exec()
        if (!promotion) {
          throw createHttpError(400, 'PROMOTION_UNAVAILABLE', 'That code is invalid, expired, or fully used.')
        }
        if (subtotal < promotion.minimumSubtotal) {
          throw createHttpError(400, 'PROMOTION_MINIMUM_NOT_MET', `This code requires a minimum order of Rs. ${promotion.minimumSubtotal}.`)
        }
        const claimedPromotion = await Promotion.findOneAndUpdate(
          { ...availability, _id: promotion._id },
          { $inc: { usageCount: 1 } },
          { returnDocument: 'after', session },
        ).exec()
        if (!claimedPromotion) {
          throw createHttpError(409, 'PROMOTION_UNAVAILABLE', 'That code has just reached its usage limit. Try another code.')
        }
        promotion = claimedPromotion
        discount = getPromotionDiscount(promotion, subtotal)
      }

      const [order] = await Order.create(
        [
          {
            orderNumber: createOrderNumber(),
            idempotencyKey: parsedBody.data.idempotencyKey,
            ...(request.customer && { accountCustomerId: request.customer._id }),
            customer: parsedBody.data.customer,
            items: orderItems,
            subtotal,
            ...(promotion && { promotionCode: promotion.code }),
            discount,
            deliveryFee: 0,
            total: subtotal - discount,
            currency: 'PKR',
            paymentMethod: 'cash_on_delivery',
            status: 'placed',
          },
        ],
        { session },
      )
      placedOrder = order
    })

    processPendingOrderNotifications().catch((notificationError) => {
      console.error(
        `Order ${placedOrder.orderNumber} was saved but its email notification could not be processed.`,
        notificationError,
      )
    })

    return response.status(201).json(orderResponse(placedOrder))
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      try {
        const existingOrder = await Order.findOne({
          idempotencyKey: parsedBody.data.idempotencyKey,
        }).exec()
        if (existingOrder) return response.status(200).json(orderResponse(existingOrder))
      } catch (lookupError) {
        return next(lookupError)
      }
    }

    return next(error)
  } finally {
    if (session) await session.endSession()
  }
}
