import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createGuestOrder } from '../controllers/orderController.js'
import { attachOptionalCustomer } from '../middleware/requireCustomer.js'

const orderRoutes = Router()

orderRoutes.post(
  '/',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'ORDER_RATE_LIMIT_EXCEEDED',
        message: 'Too many order attempts. Please try again later.',
      },
    },
  }),
  attachOptionalCustomer,
  createGuestOrder,
)

export default orderRoutes
