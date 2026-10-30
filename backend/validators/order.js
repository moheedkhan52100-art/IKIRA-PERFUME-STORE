import { z } from 'zod'

const orderItemSchema = z
  .object({
    productId: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    sku: z.string().trim().min(1).max(60).transform((value) => value.toUpperCase()),
    expectedPrice: z.number().finite().min(0),
    quantity: z.number().int().positive(),
  })
  .strict()

export const createOrderSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    promotionCode: z.string().trim().toUpperCase().min(3).max(32).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/).optional(),
    customer: z
      .object({
        fullName: z.string().trim().min(2).max(100),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[0-9][0-9 ()-]{7,19}$/, 'Enter a valid phone number.'),
        email: z.string().trim().email().max(254).optional(),
        addressLine1: z.string().trim().min(5).max(160),
        addressLine2: z.string().trim().max(160).optional(),
        city: z.string().trim().min(2).max(80),
        postalCode: z.string().trim().max(20).optional(),
      })
      .strict(),
    items: z.array(orderItemSchema).min(1).max(50),
  })
  .strict()
  .refine(
    ({ items }) => {
      const itemKeys = items.map(({ productId, sku }) => `${productId}:${sku}`)
      return new Set(itemKeys).size === itemKeys.length
    },
    {
      message: 'Each product variant may appear only once.',
      path: ['items'],
    },
  )
