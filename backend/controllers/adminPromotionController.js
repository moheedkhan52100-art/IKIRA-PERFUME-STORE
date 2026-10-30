import { Promotion } from '../models/Promotion.js'
import { recordAdminActivity } from '../utils/recordAdminActivity.js'
import {
  createPromotionSchema,
  promotionCodeSchema,
  promotionStatusSchema,
  validatePromotionSchema,
} from '../validators/adminPromotions.js'

function invalid(response, message) {
  return response.status(400).json({ error: { code: 'INVALID_PROMOTION', message } })
}

export function getPromotionDiscount(promotion, subtotal) {
  return Math.min(
    subtotal,
    promotion.discountType === 'percent'
      ? Math.round(subtotal * promotion.discountValue / 100)
      : promotion.discountValue,
  )
}

export async function validatePromotion(request, response, next) {
  const parsed = validatePromotionSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_PROMOTION', message: 'Enter a valid code and order subtotal.' } })
  try {
    const now = new Date()
    const promotion = await Promotion.findOne({
      code: parsed.data.code,
      active: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }] },
        { $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] },
      ],
    }).lean().exec()
    if (!promotion) return response.status(404).json({ error: { code: 'PROMOTION_UNAVAILABLE', message: 'That code is invalid, expired, or fully used.' } })
    if (parsed.data.subtotal < promotion.minimumSubtotal) {
      return response.status(400).json({ error: { code: 'PROMOTION_MINIMUM_NOT_MET', message: `This code requires a minimum order of Rs. ${promotion.minimumSubtotal}.` } })
    }
    return response.status(200).json({
      data: {
        code: promotion.code,
        category: promotion.category,
        discount: getPromotionDiscount(promotion, parsed.data.subtotal),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminPromotions(_request, response, next) {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 }).lean().exec()
    return response.status(200).json({ data: promotions })
  } catch (error) {
    return next(error)
  }
}

export async function createAdminPromotion(request, response, next) {
  const parsed = createPromotionSchema.safeParse(request.body)
  if (!parsed.success) return invalid(response, 'Check the code, discount, usage limit, and dates.')

  try {
    const promotion = await Promotion.create({
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
    })
    await recordAdminActivity(request, {
      action: 'promotion.create',
      summary: `${promotion.category === 'reward' ? 'Reward' : 'Coupon'} ${promotion.code} was created.`,
      target: promotion.code,
    })
    return response.status(201).json({ data: promotion })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: { code: 'PROMOTION_CODE_EXISTS', message: 'That code already exists.' } })
    return next(error)
  }
}

export async function updateAdminPromotionStatus(request, response, next) {
  const parsedCode = promotionCodeSchema.safeParse(request.params.code)
  const parsedStatus = promotionStatusSchema.safeParse(request.body)
  if (!parsedCode.success || !parsedStatus.success) return invalid(response, 'Choose a valid code and status.')

  try {
    const promotion = await Promotion.findOneAndUpdate(
      { code: parsedCode.data },
      { $set: parsedStatus.data },
      { returnDocument: 'after', runValidators: true },
    ).lean().exec()
    if (!promotion) return response.status(404).json({ error: { code: 'PROMOTION_NOT_FOUND', message: 'That promotion could not be found.' } })
    await recordAdminActivity(request, {
      action: 'promotion.status',
      summary: `${promotion.code} was ${promotion.active ? 'activated' : 'paused'}.`,
      target: promotion.code,
    })
    return response.status(200).json({ data: promotion })
  } catch (error) {
    return next(error)
  }
}

export async function deleteAdminPromotion(request, response, next) {
  const parsedCode = promotionCodeSchema.safeParse(request.params.code)
  if (!parsedCode.success) return invalid(response, 'Choose a valid promotion code.')
  try {
    const promotion = await Promotion.findOneAndDelete({ code: parsedCode.data }).lean().exec()
    if (!promotion) return response.status(404).json({ error: { code: 'PROMOTION_NOT_FOUND', message: 'That promotion could not be found.' } })
    await recordAdminActivity(request, {
      action: 'promotion.delete',
      summary: `${promotion.code} was deleted.`,
      target: promotion.code,
    })
    return response.status(204).end()
  } catch (error) {
    return next(error)
  }
}
