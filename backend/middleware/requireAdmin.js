import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

export const adminCookieName = 'ikira_admin'
export const adminSessionDurationMs = 8 * 60 * 60 * 1000

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.nodeEnv === 'production',
    path: '/api/admin',
    maxAge: adminSessionDurationMs,
  }
}

function sign(payload) {
  return createHmac('sha256', env.adminSessionSecret).update(payload).digest('base64url')
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createAdminSession(username, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: now + adminSessionDurationMs,
  })).toString('base64url')

  return `${payload}.${sign(payload)}`
}

function readAdminSession(token, now = Date.now()) {
  if (!env.adminSessionSecret || !env.adminUsername || !token) return null

  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  if (!constantTimeEqual(sign(payload), signature)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (session.sub !== env.adminUsername || !Number.isInteger(session.exp) || session.exp <= now) {
      return null
    }
    return session
  } catch {
    return null
  }
}

export function requireAdmin(request, response, next) {
  if (!env.adminUsername || !env.adminPassword || !env.adminSessionSecret) {
    response.status(503).json({
      error: {
        code: 'ADMIN_NOT_CONFIGURED',
        message: 'Admin access is not configured on this server.',
      },
    })
    return
  }

  const requestOrigin = request.get('origin')
  if (requestOrigin && !env.clientOrigins.includes(requestOrigin)) {
    response.status(403).json({
      error: {
        code: 'ADMIN_ORIGIN_DENIED',
        message: 'This origin is not allowed to access admin actions.',
      },
    })
    return
  }

  const session = readAdminSession(request.cookies?.[adminCookieName])
  if (!session) {
    response.status(401).json({
      error: {
        code: 'ADMIN_AUTH_REQUIRED',
        message: 'Sign in to access order management.',
      },
    })
    return
  }

  request.admin = { username: session.sub }
  next()
}

export function isAdminCredentialMatch(username, password) {
  if (!env.adminUsername || !env.adminPassword) return false
  return constantTimeEqual(username, env.adminUsername) &&
    constantTimeEqual(password, env.adminPassword)
}
