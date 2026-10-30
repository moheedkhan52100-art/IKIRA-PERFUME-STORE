import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Customer } from '../models/Customer.js'
import { env } from '../config/env.js'
import {
  clearCustomerSession,
  createCustomerSession,
  customerCookieName,
  customerCookieOptions,
  customerSessionDurationMs,
  serializeCustomer,
} from '../middleware/requireCustomer.js'

const scrypt = promisify(scryptCallback)
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict()
const registrationSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(100),
}).strict()

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const key = await scrypt(password, salt, 64)
  return `${salt}:${key.toString('hex')}`
}

async function passwordMatches(password, storedHash) {
  const [salt, expectedHex, extra] = (storedHash || '').split(':')
  if (!salt || !expectedHex || extra !== undefined) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function setSession(customer, response, status = 200) {
  response.cookie(
    customerCookieName,
    createCustomerSession(customer._id),
    customerCookieOptions(),
  )
  return response.status(status).json({
    data: {
      customer: serializeCustomer(customer),
      expiresIn: customerSessionDurationMs,
    },
  })
}

function ensureAuthConfigured(response) {
  if (env.customerSessionSecret && mongoose.connection.readyState === 1) return true
  response.status(503).json({
    error: {
      code: 'CUSTOMER_AUTH_UNAVAILABLE',
      message: 'Customer accounts are temporarily unavailable. Please try again later.',
    },
  })
  return false
}

export async function registerCustomerController(request, response, next) {
  if (!ensureAuthConfigured(response)) return
  const parsed = registrationSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({
      error: { code: 'INVALID_CUSTOMER_DETAILS', message: 'Enter your name, a valid email, and a password with at least 8 characters.' },
    })
  }

  try {
    const customer = await Customer.create({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    })
    return setSession(customer, response, 201)
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        error: { code: 'CUSTOMER_EMAIL_EXISTS', message: 'An account with this email already exists. Sign in instead.' },
      })
    }
    return next(error)
  }
}

export async function createCustomerSessionController(request, response, next) {
  if (!ensureAuthConfigured(response)) return
  const parsed = credentialsSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({
      error: { code: 'INVALID_CUSTOMER_CREDENTIALS', message: 'Enter a valid email and password.' },
    })
  }

  try {
    const customer = await Customer.findOne({ email: parsed.data.email }).select('+passwordHash')
    const matches = await passwordMatches(parsed.data.password, customer?.passwordHash)
    if (!customer || !matches) {
      return response.status(401).json({
        error: { code: 'INVALID_CUSTOMER_CREDENTIALS', message: 'The email or password is incorrect.' },
      })
    }
    return setSession(customer, response)
  } catch (error) {
    return next(error)
  }
}

export function readCustomerSessionController(request, response) {
  response.clearCookie(customerCookieName, {
    ...customerCookieOptions(),
    path: '/api/customer',
  })
  response.cookie(
    customerCookieName,
    createCustomerSession(request.customer._id),
    customerCookieOptions(),
  )
  return response.status(200).json({ data: { customer: serializeCustomer(request.customer) } })
}

export function deleteCustomerSessionController(_request, response) {
  clearCustomerSession(response)
  return response.status(204).end()
}
