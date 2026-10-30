import { z } from 'zod'

export const adminOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['placed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'pending']).optional(),
}).strict()

export const adminOrderStatusSchema = z.object({
  status: z.enum(['confirmed', 'shipped', 'delivered', 'cancelled']),
}).strict()

export const adminOrderItemStatusSchema = z.object({
  status: z.enum(['confirmed', 'shipped', 'delivered']),
}).strict()

export const orderItemSkuSchema = z.string().trim().min(1).max(100).transform((value) => value.toUpperCase())

export const orderNumberSchema = z.string().regex(
  /^IK-\d{4}-[A-F0-9]{10}$/,
  'Order number is invalid.',
)
