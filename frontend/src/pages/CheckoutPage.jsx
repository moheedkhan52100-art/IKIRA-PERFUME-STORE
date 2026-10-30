import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useStore from '../context/useStore.js'
import { createOrder, getProductBySlug, validatePromotion } from '../services/products.js'
import './CheckoutPromotions.css'

function formatPrice(price) {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(price)}`
}

function CheckoutPage() {
  const location = useLocation()
  const selection = location.state
  const productId = selection?.productId
  const { cart, clearCart } = useStore()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [requestState, setRequestState] = useState({
    key: '',
    status: 'loading',
    error: null,
  })
  const [retryCount, setRetryCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [placedOrder, setPlacedOrder] = useState(null)
  const [promotionCode, setPromotionCode] = useState('')
  const [appliedPromotion, setAppliedPromotion] = useState(null)
  const [promotionError, setPromotionError] = useState('')
  const [promotionBusy, setPromotionBusy] = useState(false)
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID())
  const requestKey = `${productId ?? ''}:${retryCount}`
  const loading = Boolean(productId) &&
    (requestState.key !== requestKey || requestState.status === 'loading')
  const error =
    requestState.key === requestKey && requestState.status === 'error'
      ? requestState.error
      : null

  useEffect(() => {
    if (!productId) return undefined

    const controller = new AbortController()
    getProductBySlug(productId, { signal: controller.signal })
      .then((product) => {
        setSelectedProduct(product)
        setRequestState({ key: requestKey, status: 'loaded', error: null })
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setRequestState({
            key: requestKey,
            status: 'error',
            error: requestError,
          })
        }
      })

    return () => controller.abort()
  }, [productId, requestKey])

  const items = productId
    ? selectedProduct && selection?.size
      ? [{
          product: selectedProduct,
          size: selection.size,
          quantity: selection.quantity ?? 1,
        }]
      : []
    : cart
  const subtotal = items.reduce((total, item) => {
    const variant = item.product.variants.find((option) => option.size === item.size)
    return total + (variant?.price ?? 0) * item.quantity
  }, 0)
  const activePromotion = appliedPromotion?.subtotal === subtotal ? appliedPromotion : null
  const total = Math.max(0, subtotal - (activePromotion?.discount ?? 0))

  async function handleApplyPromotion(event) {
    event.preventDefault()
    setPromotionBusy(true)
    setPromotionError('')
    setAppliedPromotion(null)
    try {
      const response = await validatePromotion(promotionCode.trim(), subtotal)
      setAppliedPromotion({ ...response.data, subtotal })
    } catch (error) {
      setPromotionError(error.message)
    } finally {
      setPromotionBusy(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setOrderError('')

    const formData = new FormData(event.currentTarget)
    const orderItems = items.map((item) => {
      const variant = item.product.variants.find((option) => option.size === item.size)
      return {
        productId: item.product.id,
        sku: variant.sku,
        expectedPrice: variant.price,
        quantity: item.quantity,
      }
    })

    try {
      const response = await createOrder({
        idempotencyKey,
        ...(activePromotion && { promotionCode: activePromotion.code }),
        customer: {
          fullName: String(formData.get('fullName')).trim(),
          phone: String(formData.get('phone')).trim(),
          email: String(formData.get('email')).trim() || undefined,
          addressLine1: String(formData.get('addressLine1')).trim(),
          addressLine2: String(formData.get('addressLine2')).trim() || undefined,
          city: String(formData.get('city')).trim(),
          postalCode: String(formData.get('postalCode')).trim() || undefined,
        },
        items: orderItems,
      })

      setPlacedOrder(response.data)
      if (!productId) clearCart()
    } catch (submissionError) {
      setOrderError(submissionError.message || 'Your order could not be placed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="api-state-page section-wrap">
        <div className="api-state" role="status">Preparing your selection…</div>
      </main>
    )
  }

  if (error && error.status !== 404) {
    return (
      <main className="api-state-page section-wrap">
        <div className="api-state" role="alert">
          <p className="eyebrow">Selection unavailable</p>
          <h1>We couldn’t load your selection.</h1>
          <p>{error.message}</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (placedOrder) {
    return (
      <main className="checkout-page section-wrap">
        <section className="order-confirmation" aria-labelledby="confirmation-title">
          <p className="eyebrow">A considered purchase</p>
          <h1 id="confirmation-title">Your order is placed.</h1>
          <p>
            Thank you, {placedOrder.customerName || 'your order is with us'}.
            We’ll contact you to confirm delivery details and collect payment on delivery.
          </p>
          <dl>
            <div><dt>Order number</dt><dd>{placedOrder.orderNumber}</dd></div>
            <div><dt>Payment</dt><dd>Cash on delivery</dd></div>
            {placedOrder.promotionCode && <div><dt>Code</dt><dd>{placedOrder.promotionCode}</dd></div>}
            {placedOrder.discount > 0 && <div><dt>Discount</dt><dd>−{formatPrice(placedOrder.discount)}</dd></div>}
            <div><dt>Order total</dt><dd>{formatPrice(placedOrder.total)}</dd></div>
          </dl>
          <Link className="hero-cta" to="/shop">Continue exploring</Link>
        </section>
      </main>
    )
  }

  if (!items.length || items.some((item) =>
    !item.product.variants.some((variant) => variant.size === item.size),
  )) {
    return (
      <main className="not-found section-wrap">
        <p className="eyebrow">Your next chapter</p>
        <h1>Choose a fragrance first.</h1>
        <p>Your bag is waiting for something special.</p>
        <Link className="hero-cta" to={productId ? '/shop' : '/cart'}>
          {productId ? 'Explore fragrances' : 'Return to your bag'}
        </Link>
      </main>
    )
  }

  return (
    <main className="checkout-page section-wrap">
      <div className="checkout-heading">
        <p className="eyebrow">A considered purchase</p>
        <h1>Delivery, thoughtfully arranged.</h1>
        <p>Share your details. Payment is collected in cash when your order arrives.</p>
      </div>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Contact details</legend>
            <label>
              Full name
              <input name="fullName" autoComplete="name" minLength="2" maxLength="100" required />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+92 300 1234567"
                maxLength="24"
                required
              />
            </label>
            <label>
              Email address <span>(optional)</span>
              <input name="email" type="email" autoComplete="email" maxLength="254" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Delivery address</legend>
            <label>
              Address
              <input
                name="addressLine1"
                autoComplete="address-line1"
                minLength="5"
                maxLength="160"
                required
              />
            </label>
            <label>
              Apartment, suite, etc. <span>(optional)</span>
              <input name="addressLine2" autoComplete="address-line2" maxLength="160" />
            </label>
            <div className="checkout-form-row">
              <label>
                City
                <input name="city" autoComplete="address-level2" minLength="2" maxLength="80" required />
              </label>
              <label>
                Postal code <span>(optional)</span>
                <input name="postalCode" autoComplete="postal-code" maxLength="20" />
              </label>
            </div>
          </fieldset>

          <div className="checkout-payment-note">
            <strong>Cash on delivery</strong>
            <span>No online payment is collected. We’ll confirm your order by phone.</span>
          </div>

          {orderError && <p className="checkout-error" role="alert">{orderError}</p>}

          <button className="hero-cta checkout-submit" type="submit" disabled={submitting}>
            {submitting ? 'Placing your order…' : 'Place order'}
          </button>
          <p className="checkout-disclaimer">
            Prices and stock are checked again before the order is accepted.
          </p>
        </form>

        <aside className="checkout-order-summary" aria-label="Order summary">
          <p className="eyebrow">Your selection</p>
          {items.map((item) => {
            const variant = item.product.variants.find((option) => option.size === item.size)
            return (
              <div className="checkout-order-item" key={`${item.product.id}:${item.size}`}>
                <div>
                  <strong>{item.product.name}</strong>
                  <span>{item.size} · Qty {item.quantity}</span>
                </div>
                <strong>{formatPrice(variant.price * item.quantity)}</strong>
              </div>
            )
          })}
          <div className="checkout-order-total">
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <form className="checkout-promotion-form" onSubmit={handleApplyPromotion}>
            <label htmlFor="checkout-promotion-code">Discount or reward code</label>
            <div>
              <input
                id="checkout-promotion-code"
                value={promotionCode}
                onChange={(event) => {
                  setPromotionCode(event.target.value.toUpperCase())
                  setAppliedPromotion(null)
                  setPromotionError('')
                }}
                maxLength={32}
                placeholder="Enter code"
                aria-describedby="checkout-promotion-feedback"
              />
              <button type="submit" disabled={promotionBusy || !promotionCode.trim()}>
                {promotionBusy ? 'Checking…' : 'Apply'}
              </button>
            </div>
            <p id="checkout-promotion-feedback" role={promotionError ? 'alert' : 'status'}>
              {promotionError || (activePromotion ? `${activePromotion.code} applied: ${formatPrice(activePromotion.discount)} off.` : '')}
            </p>
          </form>
          {activePromotion && <div className="checkout-order-total"><span>Discount</span><strong>−{formatPrice(activePromotion.discount)}</strong></div>}
          <div className="checkout-order-total">
            <span>Delivery</span>
            <strong>Free</strong>
          </div>
          <div className="checkout-order-total checkout-grand-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <p>Free delivery for initial cash-on-delivery orders.</p>
          {!productId && <Link className="cart-continue-link" to="/cart">Edit your bag</Link>}
        </aside>
      </div>
    </main>
  )
}

export default CheckoutPage
