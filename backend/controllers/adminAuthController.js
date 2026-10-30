import { z } from 'zod'
import {
  adminCookieName,
  adminCookieOptions,
  adminSessionDurationMs,
  createAdminSession,
  isAdminCredentialMatch,
} from '../middleware/requireAdmin.js'
import { env } from '../config/env.js'
import { recordAdminActivity } from '../utils/recordAdminActivity.js'

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
}).strict()

export async function createAdminSessionController(request, response) {
  if (!env.adminUsername || !env.adminPassword || !env.adminSessionSecret) {
    return response.status(503).json({
      error: {
        code: 'ADMIN_NOT_CONFIGURED',
        message: 'Admin access is not configured on this server.',
      },
    })
  }

  const parsed = credentialsSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Enter a username and password.',
      },
    })
  }

  if (!isAdminCredentialMatch(parsed.data.username, parsed.data.password)) {
    return response.status(401).json({
      error: {
        code: 'INVALID_ADMIN_CREDENTIALS',
        message: 'The username or password is incorrect.',
      },
    })
  }

  request.admin = { username: parsed.data.username }
  await recordAdminActivity(request, {
    action: 'admin.login',
    summary: 'Admin ' + parsed.data.username + ' signed in.',
    target: parsed.data.username,
  })

  response.cookie(
    adminCookieName,
    createAdminSession(parsed.data.username),
    adminCookieOptions(),
  )
  return response.status(200).json({
    data: {
      username: parsed.data.username,
      expiresIn: adminSessionDurationMs,
    },
  })
}

export function readAdminSessionController(request, response) {
  return response.status(200).json({
    data: { username: request.admin.username },
  })
}

export function deleteAdminSessionController(_request, response) {
  response.clearCookie(adminCookieName, adminCookieOptions())
  return response.status(204).end()
}
