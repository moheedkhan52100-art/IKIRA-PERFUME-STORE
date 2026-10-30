const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`
).replace(/\/$/, '')

class CustomerAuthError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'CustomerAuthError'
    this.status = status
    this.code = code
  }
}

async function requestCustomerJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/customer${path}`, {
    ...options,
    credentials: 'include',
  })
  if (response.status === 204) return null

  const body = await response.json()
  if (!response.ok) {
    throw new CustomerAuthError(
      body.error?.message || 'The account service could not complete the request.',
      response.status,
      body.error?.code,
    )
  }
  return body
}

export function getCustomerOrders() {
  return requestCustomerJson('/orders')
}

export function getCustomerSession() {
  return requestCustomerJson('/session')
}

export function createCustomerSession(credentials) {
  return requestCustomerJson('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

export function registerCustomer(details) {
  return requestCustomerJson('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  })
}

export function deleteCustomerSession() {
  return requestCustomerJson('/session', { method: 'DELETE' })
}
