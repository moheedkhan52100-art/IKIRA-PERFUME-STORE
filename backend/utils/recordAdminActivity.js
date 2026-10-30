import { AdminActivity } from '../models/AdminActivity.js'

export async function recordAdminActivity(request, { action, summary, target }) {
  try {
    await AdminActivity.create({
      actor: request.admin?.username ?? 'admin',
      action,
      summary,
      target,
    })
  } catch (error) {
    console.error(`Admin activity could not be recorded for "${action}".`, error)
  }
}
