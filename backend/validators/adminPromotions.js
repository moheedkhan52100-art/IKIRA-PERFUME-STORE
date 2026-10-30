import { z } from 'zod'

const code = z.string().trim().toUpperCase().min(3).max(32).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)

export const createPromotionSchema = z.object({
  code,
  category: z.enum(['coupon', 'reward']).default('coupon'),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().int().min(1),
  minimumSubtotal: z.number().int().min(0).default(0),
  usageLimit: z.number().int().positive().nullable().default(null),
  startsAt: z.string().datetime().nullable().default(null),
  endsAt: z.string().datetime().nullable().default(null),
}).strict().superRefine((promotion, context) => {
  if (promotion.discountType === 'percent' && promotion.discountValue > 100) {
    context.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percentage discounts cannot exceed 100%.' })
  }
  if (promotion.startsAt && promotion.endsAt && new Date(promotion.endsAt) <= new Date(promotion.startsAt)) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: 'End date must be later than the start date.' })
  }
})

export const promotionStatusSchema = z.object({ active: z.boolean() }).strict()
export const promotionCodeSchema = z.string().trim().toUpperCase().min(3).max(32).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
export const validatePromotionSchema = z.object({
  code,
  subtotal: z.number().positive(),
}).strict()
