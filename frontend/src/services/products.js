const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`
).replace(/\/$/, '')

class ProductApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ProductApiError'
    this.status = status
    this.code = code
  }
}

function normalizeImageUrl(url) {
  return url ? new URL(url, `${apiBaseUrl}/`).toString() : ''
}

function normalizeProduct(product) {
  const imageUrl = normalizeImageUrl(product.imageUrl)
  const galleryImages = (product.galleryImages ?? []).map(normalizeImageUrl)

  return {
    ...product,
    id: product.slug,
    imageUrl,
    galleryImages,
    isNew: product.isNew ?? product.newArrival,
    collection: product.collection ?? product.collectionName,
    sizes: product.variants.map((variant) => variant.size),
  }
}

async function requestJson(url, options) {
  let response
  try {
    response = await fetch(url, options)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ProductApiError(
      `Could not reach the store API at ${new URL(url).origin}. Make sure the backend is running.`,
      0,
      'API_UNREACHABLE',
    )
  }
  const body = await response.json()

  if (!response.ok) {
    throw new ProductApiError(
      body.error?.message || 'The product service could not complete the request.',
      response.status,
      body.error?.code,
    )
  }

  return body
}

async function requestAdminJson(url, options = {}) {
  return requestJson(url, {
    ...options,
    credentials: 'include',
  })
}

export async function getProducts(filters = {}, { signal } = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }

  const suffix = query.size ? `?${query}` : ''
  const response = await requestJson(`${apiBaseUrl}/products${suffix}`, { signal })

  return {
    ...response,
    data: response.data.map(normalizeProduct),
  }
}

export async function getProductBySlug(slug, { signal } = {}) {
  const response = await requestJson(
    `${apiBaseUrl}/products/${encodeURIComponent(slug)}`,
    { signal },
  )

  return normalizeProduct(response.data)
}

export function getProductFilterOptions({ signal } = {}) {
  return requestJson(`${apiBaseUrl}/products/filters`, { signal })
}

export function createOrder(order) {
  return requestJson(`${apiBaseUrl}/orders`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
}

export function createAdminSession(credentials) {
  return requestAdminJson(`${apiBaseUrl}/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

export function getAdminSession() {
  return requestAdminJson(`${apiBaseUrl}/admin/session`)
}

export async function deleteAdminSession() {
  const response = await fetch(`${apiBaseUrl}/admin/session`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!response.ok) {
    const body = await response.json()
    throw new ProductApiError(
      body.error?.message || 'Admin sign-out could not be completed.',
      response.status,
      body.error?.code,
    )
  }
}

export function getAdminOrders({ page = 1, limit = 20, status = '' } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) query.set('status', status)
  return requestAdminJson(`${apiBaseUrl}/admin/orders?${query}`)
}

export async function getAdminProducts(filters = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const suffix = query.size ? `?${query}` : ''
  const response = await requestAdminJson(`${apiBaseUrl}/admin/products${suffix}`)
  return { ...response, data: response.data.map(normalizeProduct) }
}

export function getAdminOrder(orderNumber) {
  return requestAdminJson(
    `${apiBaseUrl}/admin/orders/${encodeURIComponent(orderNumber)}`,
  )
}

export function updateAdminOrderStatus(orderNumber, status) {
  return requestAdminJson(
    `${apiBaseUrl}/admin/orders/${encodeURIComponent(orderNumber)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
}

export function updateAdminOrderItemStatus(orderNumber, sku, status) {
  return requestAdminJson(
    `${apiBaseUrl}/admin/orders/${encodeURIComponent(orderNumber)}/items/${encodeURIComponent(sku)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
}

export function getAdminOverview() {
  return requestAdminJson(`${apiBaseUrl}/admin/overview`)
}

export function getAdminActivity() {
  return requestAdminJson(`${apiBaseUrl}/admin/activity`)
}

export function getAdminCategories() {
  return requestAdminJson(`${apiBaseUrl}/admin/categories`)
}

export function createAdminCategory(name) {
  return requestAdminJson(`${apiBaseUrl}/admin/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function deleteAdminCategory(key) {
  return requestAdminJson(`${apiBaseUrl}/admin/categories/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
}

export function getAdminCustomers() {
  return requestAdminJson(`${apiBaseUrl}/admin/customers`)
}

export function getAdminPromotions() {
  return requestAdminJson(`${apiBaseUrl}/admin/promotions`)
}

export function getAdminReviews() {
  return requestAdminJson(`${apiBaseUrl}/admin/reviews`)
}

export function createAdminPromotion(promotion) {
  return requestAdminJson(`${apiBaseUrl}/admin/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(promotion),
  })
}

export function updateAdminPromotionStatus(code, active) {
  return requestAdminJson(`${apiBaseUrl}/admin/promotions/${encodeURIComponent(code)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  })
}

export function deleteAdminPromotion(code) {
  return requestAdminJson(`${apiBaseUrl}/admin/promotions/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  })
}

export function validatePromotion(code, subtotal) {
  return requestJson(`${apiBaseUrl}/products/promotions/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal }),
  })
}

export function createAdminProduct(product) {
  return requestAdminJson(`${apiBaseUrl}/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  })
}

export function uploadAdminProductImage(slug, imageFile, kind = 'front') {
  const formData = new FormData()
  formData.set('image', imageFile)
  formData.set('kind', kind)
  return requestAdminJson(
    `${apiBaseUrl}/admin/products/${encodeURIComponent(slug)}/image`,
    {
      method: 'POST',
      body: formData,
    },
  ).then((response) => ({
    ...response,
    data: {
      ...response.data,
      imageUrl: normalizeImageUrl(response.data.imageUrl),
      galleryImages: (response.data.galleryImages ?? []).map(normalizeImageUrl),
    },
  }))
}

export function deleteAdminProductGalleryImage(slug, imageUrl) {
  const imageId = imageUrl.split('/').pop()
  return requestAdminJson(
    `${apiBaseUrl}/admin/products/${encodeURIComponent(slug)}/images/${encodeURIComponent(imageId)}`,
    { method: 'DELETE' },
  ).then((response) => ({
    ...response,
    data: { ...response.data, galleryImages: (response.data.galleryImages ?? []).map(normalizeImageUrl) },
  }))
}

export function deleteAdminProductImage(slug) {
  return requestAdminJson(
    `${apiBaseUrl}/admin/products/${encodeURIComponent(slug)}/image`,
    { method: 'DELETE' },
  )
}

export function updateAdminProductInventory(slug, inventory) {
  return requestAdminJson(
    `${apiBaseUrl}/admin/products/${encodeURIComponent(slug)}/inventory`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inventory),
    },
  )
}

export function updateAdminProductVisibility(slug, published) {
  return requestAdminJson(
    `${apiBaseUrl}/admin/products/${encodeURIComponent(slug)}/visibility`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published }),
    },
  )
}

export function getProductReviews(slug, { signal } = {}) {
  return requestJson(
    apiBaseUrl + '/products/' + encodeURIComponent(slug) + '/reviews',
    { signal },
  )
}

export function createProductReview(slug, review) {
  return requestJson(
    apiBaseUrl + '/products/' + encodeURIComponent(slug) + '/reviews',
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    },
  )
}
