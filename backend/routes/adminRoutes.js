import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  createAdminSessionController,
  deleteAdminSessionController,
  readAdminSessionController,
} from '../controllers/adminAuthController.js'
import {
  getAdminOrder,
  listAdminOrders,
  updateAdminOrderItemStatus,
  updateAdminOrderStatus,
} from '../controllers/adminOrderController.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import {
  createAdminPromotion,
  deleteAdminPromotion,
  listAdminPromotions,
  updateAdminPromotionStatus,
} from '../controllers/adminPromotionController.js'
import { listAdminReviews } from '../controllers/reviewController.js'
import { listProducts } from '../controllers/productController.js'
import { uploadProductImage } from '../middleware/productImageUpload.js'
import {
  deleteAdminProductImage,
  uploadAdminProductImage,
  deleteAdminProductGalleryImage,
} from '../controllers/productImageController.js'
import {
  createAdminProduct,
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  listAdminActivity,
  getAdminOverview,
  listAdminCustomers,
  updateAdminProductInventory,
  updateAdminProductVisibility,
} from '../controllers/adminProductController.js'

const adminRoutes = Router()

adminRoutes.post(
  '/session',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  createAdminSessionController,
)
adminRoutes.delete('/session', deleteAdminSessionController)
adminRoutes.get('/session', requireAdmin, readAdminSessionController)
adminRoutes.get('/orders', requireAdmin, listAdminOrders)
adminRoutes.get('/orders/:orderNumber', requireAdmin, getAdminOrder)
adminRoutes.patch('/orders/:orderNumber/status', requireAdmin, updateAdminOrderStatus)
adminRoutes.patch('/orders/:orderNumber/items/:sku/status', requireAdmin, updateAdminOrderItemStatus)
adminRoutes.get('/overview', requireAdmin, getAdminOverview)
adminRoutes.get('/activity', requireAdmin, listAdminActivity)
adminRoutes.get('/categories', requireAdmin, listAdminCategories)
adminRoutes.post('/categories', requireAdmin, createAdminCategory)
adminRoutes.delete('/categories/:key', requireAdmin, deleteAdminCategory)
adminRoutes.get('/customers', requireAdmin, listAdminCustomers)
adminRoutes.get('/products', requireAdmin, (request, response, next) => listProducts(request, response, next, { includeHidden: true }))
adminRoutes.get('/promotions', requireAdmin, listAdminPromotions)
adminRoutes.get('/reviews', requireAdmin, listAdminReviews)
adminRoutes.post('/promotions', requireAdmin, createAdminPromotion)
adminRoutes.patch('/promotions/:code/status', requireAdmin, updateAdminPromotionStatus)
adminRoutes.delete('/promotions/:code', requireAdmin, deleteAdminPromotion)
adminRoutes.post('/products', requireAdmin, createAdminProduct)
adminRoutes.patch('/products/:slug/inventory', requireAdmin, updateAdminProductInventory)
adminRoutes.patch('/products/:slug/visibility', requireAdmin, updateAdminProductVisibility)
adminRoutes.post(
  '/products/:slug/image',
  requireAdmin,
  uploadProductImage,
  uploadAdminProductImage,
)
adminRoutes.delete('/products/:slug/image', requireAdmin, deleteAdminProductImage)
adminRoutes.delete('/products/:slug/images/:imageId', requireAdmin, deleteAdminProductGalleryImage)

export default adminRoutes
