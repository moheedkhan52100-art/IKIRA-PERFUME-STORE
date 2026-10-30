import { Router } from 'express'
import {
  getProductBySlug,
  getProductFilterOptions,
  listProducts,
} from '../controllers/productController.js'
import { createProductReview, listProductReviews } from '../controllers/reviewController.js'
import { requireCustomer } from '../middleware/requireCustomer.js'
import { validatePromotion } from '../controllers/adminPromotionController.js'

const productRoutes = Router()

productRoutes.get('/', listProducts)
productRoutes.get('/filters', getProductFilterOptions)
productRoutes.get('/:slug/reviews', listProductReviews)
productRoutes.post('/promotions/validate', validatePromotion)
productRoutes.post('/:slug/reviews', requireCustomer, createProductReview)
productRoutes.get('/:slug', getProductBySlug)

export default productRoutes
