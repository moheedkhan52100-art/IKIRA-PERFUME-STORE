import { z } from 'zod'

const optionalPrice = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().finite().min(0).optional(),
)

export const productListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    search: z.string().trim().min(1).max(100).optional(),
    familyKey: z.string().trim().min(1).max(60).optional(),
    gender: z.enum(['men', 'women', 'unisex']).optional(),
    category: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    size: z.string().trim().min(1).max(20).optional(),
    concentration: z.string().trim().min(1).max(60).optional(),
    collection: z.string().trim().min(1).max(60).optional(),
    available: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    minPrice: optionalPrice,
    maxPrice: optionalPrice,
    sort: z
      .enum([
        'featured',
        'bestselling',
        'name-asc',
        'price-asc',
        'price-desc',
        'rating',
        'newest',
      ])
      .default('name-asc'),
  })
  .strict()
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    {
      message: 'minPrice must not exceed maxPrice.',
      path: ['minPrice'],
    },
  )

export const productSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
