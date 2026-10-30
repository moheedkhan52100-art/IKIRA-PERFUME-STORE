import { z } from 'zod'

export const adminCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
}).strict()

export const adminCategoryKeySchema = z.string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
