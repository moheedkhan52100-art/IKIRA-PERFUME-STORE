import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { Customer } from '../models/Customer.js'

export const customerCookieName = 'ikira_customer'
export const customerSessionDurationMs = 7 * 24 * 60 * 60 * 1000

export function customerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.nodeEnv === 'production',
    path: '/api',
    maxAge: customerSessionDurationMs,
  }
}

function sign(payload) {
  return createHmac('sha256', env.customerSessionSecret).update(payload).digest('base64url')
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createCustomerSession(customerId, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(customerId),
    exp: now + customerSessionDurationMs,
  })).toString('base64url')

  return `${payload}.${sign(payload)}`
}

function readCustomerSession(token, now = Date.now()) {
  if (!env.customerSessionSecret || !token) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined || !constantTimeEqual(sign(payload), signature)) {
    return null
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!/^[a-f\d]{24}$/i.test(session.sub) || !Number.isInteger(session.exp) || session.exp <= now) {
      return null
    }
    return session
  } catch {
    return null
  }
}

export function serializeCustomer(customer) {
  return {
    id: String(customer._id),
    fullName: customer.fullName,
    email: customer.email,
  }
}

export async function requireCustomer(request, response, next) {
  if (!env.customerSessionSecret) {
    response.status(503).json({
      error: { code: 'CUSTOMER_AUTH_NOT_CONFIGURED', message: 'Customer sign in is not configured on this server.' },
    })
    return
  }

  const requestOrigin = request.get('origin')
  if (requestOrigin && !env.clientOrigins.includes(requestOrigin)) {
    response.status(403).json({
      error: { code: 'CUSTOMER_ORIGIN_DENIED', message: 'This origin is not allowed to access customer account actions.' },
    })
    return
  }

  const session = readCustomerSession(request.cookies?.[customerCookieName])
  if (!session) {
    response.status(401).json({
      error: { code: 'CUSTOMER_AUTH_REQUIRED', message: 'Sign in to access your account.' },
    })
    return
  }

  try {
    const customer = await Customer.findById(session.sub)
    if (!customer) {
      response.status(401).json({
        error: { code: 'CUSTOMER_AUTH_REQUIRED', message: 'Sign in to access your account.' },
      })
      return
    }
    request.customer = customer
    next()
  } catch (error) {
    next(error)
  }
}

export async function attachOptionalCustomer(request, _response, next) {
  const requestOrigin = request.get('origin')
  if (requestOrigin && !env.clientOrigins.includes(requestOrigin)) return next()

  const session = readCustomerSession(request.cookies?.[customerCookieName])
  if (!session) return next()

  try {
    request.customer = await Customer.findById(session.sub)
    return next()
  } catch (error) {
    return next(error)
  }
}
export function clearCustomerSession(response) {
  response.clearCookie(customerCookieName, customerCookieOptions())
}
