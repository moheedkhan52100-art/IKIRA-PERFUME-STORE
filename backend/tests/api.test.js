import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { createApp } from '../app.js'
import { env } from '../config/env.js'
import { getDatabaseStatus } from '../database/connection.js'

let server
let baseUrl

before(async () => {
  server = createServer(createApp())
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})

test('health endpoint reports the API as available', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
  assert.equal(body.database, env.mongoUri ? 'disconnected' : 'not_configured')
  assert.equal(body.notifications, env.emailConfigured ? 'ready' : 'not_configured')
  assert.equal(body.service, 'ikira-api')
  assert.ok(Number.isNaN(Date.parse(body.timestamp)) === false)
})

test('readiness endpoint reports unavailable required production services', async () => {
  const response = await fetch(`${baseUrl}/api/health/ready`)
  const body = await response.json()
  const expectedReady = Boolean(
    getDatabaseStatus() === 'connected' &&
    env.adminUsername &&
    env.adminPassword &&
    env.adminSessionSecret &&
    env.emailConfigured,
  )

  assert.equal(response.status, expectedReady ? 200 : 503)
  assert.equal(body.status, expectedReady ? 'ready' : 'not_ready')
  assert.equal(typeof body.checks.database, 'boolean')
  assert.equal(typeof body.checks.admin, 'boolean')
  assert.equal(typeof body.checks.orderNotifications, 'boolean')
})

test('unknown API paths return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error.code, 'NOT_FOUND')
})

test('product listing rejects invalid pagination and price ranges', async () => {
  const invalidPagination = await fetch(`${baseUrl}/api/products?limit=51`)
  const invalidPriceRange = await fetch(
    `${baseUrl}/api/products?minPrice=20000&maxPrice=10000`,
  )
  const paginationBody = await invalidPagination.json()
  const priceRangeBody = await invalidPriceRange.json()

  assert.equal(invalidPagination.status, 400)
  assert.equal(paginationBody.error.code, 'INVALID_QUERY')
  assert.equal(invalidPriceRange.status, 400)
  assert.equal(priceRangeBody.error.code, 'INVALID_QUERY')
})

test('product detail rejects malformed slugs', async () => {
  const response = await fetch(`${baseUrl}/api/products/not_a_valid_slug`)
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'INVALID_PRODUCT_SLUG')
})

test('order endpoint rejects untrusted or incomplete order details', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { fullName: 'A Customer' },
      items: [{ productId: 'cedar-veil', sku: 'IK-CEDARVEIL-01', quantity: 1, price: 1 }],
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'INVALID_ORDER')
})

test('admin order APIs require configured authentication', async () => {
  const response = await fetch(`${baseUrl}/api/admin/orders`)
  const body = await response.json()

  assert.ok([401, 503].includes(response.status))
  assert.ok(['ADMIN_AUTH_REQUIRED', 'ADMIN_NOT_CONFIGURED'].includes(body.error.code))
})

test('new admin catalog and customer routes require authentication', async () => {
  const responses = await Promise.all([
    fetch(`${baseUrl}/api/admin/overview`),
    fetch(`${baseUrl}/api/admin/activity`),
    fetch(`${baseUrl}/api/admin/categories`),
    fetch(`${baseUrl}/api/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bridal' }),
    }),
    fetch(`${baseUrl}/api/admin/categories/bridal`, { method: 'DELETE' }),
    fetch(`${baseUrl}/api/admin/customers`),
    fetch(`${baseUrl}/api/admin/products/cedar-veil/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false }),
    }),
    fetch(`${baseUrl}/api/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized product' }),
    }),
  ])
  const bodies = await Promise.all(responses.map((response) => response.json()))

  for (const [index, response] of responses.entries()) {
    assert.ok([401, 503].includes(response.status))
    assert.ok(['ADMIN_AUTH_REQUIRED', 'ADMIN_NOT_CONFIGURED'].includes(bodies[index].error.code))
  }
})

test('admin product image uploads require an admin session', async () => {
  const form = new FormData()
  form.set('image', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], {
    type: 'image/png',
  }), 'bottle.png')
  const response = await fetch(`${baseUrl}/api/admin/products/cedar-veil/image`, {
    method: 'POST',
    body: form,
  })
  const body = await response.json()

  assert.ok([401, 503].includes(response.status))
  assert.ok(['ADMIN_AUTH_REQUIRED', 'ADMIN_NOT_CONFIGURED'].includes(body.error.code))
})

test('product media rejects malformed identifiers without accessing the database', async () => {
  const response = await fetch(`${baseUrl}/api/media/not-an-object-id`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error.code, 'IMAGE_NOT_FOUND')
})

test('CORS only reflects configured browser origins', async () => {
  const allowedResponse = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://127.0.0.1:5173' },
  })
  const deniedResponse = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://untrusted.example' },
  })

  assert.equal(
    allowedResponse.headers.get('access-control-allow-origin'),
    'http://127.0.0.1:5173',
  )
  assert.equal(deniedResponse.headers.get('access-control-allow-origin'), null)
})
