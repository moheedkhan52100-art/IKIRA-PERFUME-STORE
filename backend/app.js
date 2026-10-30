import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { getDatabaseStatus } from './database/connection.js'
import { env } from './config/env.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import { getProductImage } from './controllers/productImageController.js'

export function createApp() {
  const app = express()
  const allowedOrigins = new Set(env.clientOrigins)

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        callback(null, !origin || allowedOrigins.has(origin))
      },
    }),
  )
  app.use(express.json({ limit: '20kb' }))
  app.use(cookieParser())
  app.use(
    '/api',
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      limit: env.rateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      },
    }),
  )

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      database: getDatabaseStatus(),
      notifications: env.emailConfigured ? 'ready' : 'not_configured',
      service: 'ikira-api',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api/health/ready', (_request, response) => {
    const checks = {
      database: getDatabaseStatus() === 'connected',
      admin: Boolean(
        env.adminUsername &&
        env.adminPassword &&
        env.adminSessionSecret,
      ),
      customerAuth: Boolean(env.customerSessionSecret),
      orderNotifications: env.emailConfigured,
    }
    const ready = Object.values(checks).every(Boolean)

    response.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      checks,
      service: 'ikira-api',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api', (_request, response) => {
    response.status(200).json({
      name: 'IKIRA API',
      version: '1.0.0',
      health: '/api/health',
    })
  })

  app.use('/api/products', productRoutes)
  app.use('/api/orders', orderRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/customer', customerRoutes)
  app.get('/api/media/:id', getProductImage)

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route was not found.',
      },
    })
  })

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error)
      return
    }

    const candidateStatus = error.statusCode ?? error.status
    const statusCode =
      Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
        ? candidateStatus
        : 500

    if (statusCode >= 500) {
      console.error(error)
    }

    response.status(statusCode).json({
      error: {
        code:
          statusCode < 500 && error.code
            ? error.code
            : statusCode === 413
              ? 'PAYLOAD_TOO_LARGE'
              : 'REQUEST_FAILED',
        message:
          statusCode >= 500
            ? 'An unexpected server error occurred.'
            : error.message,
      },
    })
  })

  return app
}
