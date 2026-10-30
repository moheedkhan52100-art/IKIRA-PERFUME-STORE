import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  createCustomerSessionController,
  deleteCustomerSessionController,
  readCustomerSessionController,
  registerCustomerController,
} from '../controllers/customerAuthController.js'
import { requireCustomer } from '../middleware/requireCustomer.js'
import { readCustomerOrdersController } from '../controllers/customerOrderController.js'

const customerRoutes = Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

customerRoutes.post('/register', authLimiter, registerCustomerController)
customerRoutes.post('/session', authLimiter, createCustomerSessionController)
customerRoutes.get('/session', requireCustomer, readCustomerSessionController)
customerRoutes.get('/orders', requireCustomer, readCustomerOrdersController)
customerRoutes.delete('/session', deleteCustomerSessionController)

export default customerRoutes
