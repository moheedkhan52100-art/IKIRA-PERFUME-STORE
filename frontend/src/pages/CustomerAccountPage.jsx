import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import {
  deleteCustomerSession,
  getCustomerOrders,
  getCustomerSession,
} from '../services/customerAuth.js'
import './CustomerAccountPage.css'

const accountSections = [
  ['profile', 'My Profile', '/account/profile'],
  ['orders', 'My Orders', '/account/orders'],
  ['track-order', 'Track My Order', '/account/track-order'],
  ['wishlist', 'My Wishlist', '/wishlist'],
  ['addresses', 'My Addresses', '/account/addresses'],
  ['reviews', 'My Reviews', '/account/reviews'],
  ['preferences', 'Fragrance Preferences', '/account/preferences'],
  ['rewards', 'Rewards & Coupons', '/account/rewards'],
  ['settings', 'Account Settings', '/account/settings'],
  ['support', 'Help & Support', '/account/support'],
]

const orderStages = ['placed', 'confirmed', 'shipped', 'delivered']

function formatPrice(price) {
  return 'Rs. ' + new Intl.NumberFormat('en-PK').format(price)
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function getWishlistCount() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('ikira-wishlist-v1') || '[]')
    return Array.isArray(saved) ? saved.length : 0
  } catch {
    return 0
  }
}

function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function CustomerAccountPage() {
  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [checkingSession, setCheckingSession] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [error, setError] = useState('')
  const [ordersError, setOrdersError] = useState('')
  const [ordersRetry, setOrdersRetry] = useState(0)
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'dashboard'
  const sectionTitle = accountSections.find(([key]) => key === section)?.[1] || 'Account overview'

  useEffect(() => {
    let active = true
    getCustomerSession()
      .then(async (response) => {
        if (!active) return
        setCustomer(response.data.customer)
        setLoadingOrders(true)
        setOrdersError('')
        try {
          const ordersResponse = await getCustomerOrders()
          if (active) setOrders(ordersResponse.data)
        } catch (ordersRequestError) {
          if (active) setOrdersError(ordersRequestError.message)
        } finally {
          if (active) setLoadingOrders(false)
        }
      })
      .catch((sessionError) => {
        if (active && sessionError.status !== 401) setError(sessionError.message)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [ordersRetry])

  const addresses = useMemo(() => {
    const seen = new Set()
    return orders.filter((order) => {
      const key = [
        order.customer.addressLine1,
        order.customer.addressLine2,
        order.customer.city,
        order.customer.postalCode,
      ].filter(Boolean).join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [orders])

  async function handleSignOut() {
    setError('')
    try {
      await deleteCustomerSession()
      setCustomer(null)
      window.dispatchEvent(new CustomEvent('ikira:customer-session', {
        detail: { customer: null },
      }))
    } catch (signOutError) {
      setError(signOutError.message)
    }
  }

  function renderOrders(tracking = false) {
    if (loadingOrders) return <p className="customer-orders-message" role="status">Loading your orders�</p>
    if (ordersError) {
      return (
        <div className="customer-orders-message" role="alert">
          <p>{ordersError}</p>
          <button type="button" onClick={() => setOrdersRetry((count) => count + 1)}>Try again</button>
        </div>
      )
    }
    if (!orders.length) {
      return (
        <div className="customer-orders-empty">
          <p>You haven�t placed an order while signed in yet.</p>
          <Link className="text-link" to="/shop">Explore the collection</Link>
        </div>
      )
    }

    return (
      <div className="customer-order-list">
        {orders.map((order) => (
          <article className="customer-order-card" key={order.orderNumber}>
            <header className="customer-order-header">
              <div>
                <p className="eyebrow">ORDER {order.orderNumber}</p>
                <time dateTime={order.createdAt}>Placed {formatDate(order.createdAt)}</time>
              </div>
              <span className={'customer-order-status status-' + order.status}>
                {formatStatus(order.status)}
              </span>
            </header>
            {tracking && (
              <div className="customer-order-tracking">
                {order.status === 'cancelled'
                  ? <p>This order was cancelled.</p>
                  : <>
                      <ol aria-label={'Order progress for ' + order.orderNumber}>
                        {orderStages.map((stage) => (
                          <li className={orderStages.indexOf(stage) <= orderStages.indexOf(order.status) ? 'is-complete' : ''} key={stage}>
                            <span aria-hidden="true" />
                            {formatStatus(stage)}
                          </li>
                        ))}
                      </ol>
                      <p>Order status is updated by IKIRA. Carrier tracking is not available for this order.</p>
                    </>}
              </div>
            )}
            <ul className="customer-order-items">
              {order.items.map((item) => (
                <li key={item.sku}>
                  <span>{item.productName} � {item.size} � {item.quantity}</span>
                  <span>{formatPrice(item.lineTotal)}</span>
                  <small className="customer-order-item-status">{formatStatus(item.status ?? order.status)}</small>
                </li>
              ))}
            </ul>
            <div className="customer-order-footer">
              <span>{order.paymentMethod === 'cash_on_delivery' ? 'Cash on delivery' : order.paymentMethod}</span>
              <strong>Total � {formatPrice(order.total)}</strong>
            </div>
            <p className="customer-order-delivery">
              Delivering to {order.customer.city} � {order.customer.addressLine1}
            </p>
          </article>
        ))}
      </div>
    )
  }

  function renderSection() {
    if (section === 'profile') {
      return (
        <div className="customer-account-panel">
          <h2>Profile details</h2>
          <dl className="customer-profile-details">
            <div><dt>Full name</dt><dd>{customer.fullName}</dd></div>
            <div><dt>Email address</dt><dd>{customer.email}</dd></div>
          </dl>
          <p>Profile editing is not available yet. Your account details are shown here as saved.</p>
        </div>
      )
    }

    if (section === 'orders' || section === 'track-order') {
      return (
        <div className="customer-account-panel">
          <h2>{section === 'orders' ? 'Your orders' : 'Order tracking'}</h2>
          {section === 'track-order' && <p>Follow the latest status for each order placed while signed in.</p>}
          {renderOrders(section === 'track-order')}
        </div>
      )
    }

    if (section === 'addresses') {
      return (
        <div className="customer-account-panel">
          <h2>Delivery addresses</h2>
          <p>Addresses below are taken from your order history. Address book editing is not available yet.</p>
          {addresses.length ? (
            <div className="customer-address-list">
              {addresses.map((order) => (
                <article key={order.orderNumber}>
                  <strong>{order.customer.city}</strong>
                  <p>{order.customer.addressLine1}{order.customer.addressLine2 ? ', ' + order.customer.addressLine2 : ''}</p>
                  <span>{order.customer.postalCode || 'No postal code'} � {order.customer.phone}</span>
                </article>
              ))}
            </div>
          ) : <p className="customer-orders-empty">Your delivery addresses will appear after your first signed-in order.</p>}
        </div>
      )
    }

    if (section === 'settings') {
      return (
        <div className="customer-account-panel">
          <h2>Account settings</h2>
          <dl className="customer-profile-details">
            <div><dt>Signed in as</dt><dd>{customer.email}</dd></div>
            <div><dt>Session</dt><dd>Secure account session</dd></div>
          </dl>
          <p>Password changes and notification preferences are not available yet.</p>
          <button className="admin-secondary-button" type="button" onClick={handleSignOut}>Logout</button>
        </div>
      )
    }

    const unavailable = {
      reviews: ['My Reviews', 'Reviews are not available yet.'],
      preferences: ['Fragrance Preferences', 'Fragrance preference saving is not available yet.'],
      rewards: ['Rewards & Coupons', 'Rewards and coupons are not available yet.'],
      support: ['Help & Support', 'For help with an order, contact IKIRA with your order number.'],
    }[section]

    if (unavailable) {
      return (
        <div className="customer-account-panel customer-feature-panel">
          <h2>{unavailable[0]}</h2>
          <p>{unavailable[1]}</p>

        </div>
      )
    }

    return (
      <div className="customer-account-panel">
        <div className="customer-dashboard-summary">
          <article><span>Orders</span><strong>{orders.length}</strong></article>
          <article><span>Latest order status</span><strong>{orders[0] ? formatStatus(orders[0].status) : '�'}</strong></article>
          <article><span>Wishlist items</span><strong>{getWishlistCount()}</strong></article>
        </div>
        <h2>Your orders</h2>
        {renderOrders(false)}
        <div className="customer-account-shortcuts">
          {accountSections.map(([key, label, to]) => (
            <Link key={key} to={to}><span>{label}</span><span aria-hidden="true">?</span></Link>
          ))}
        </div>
      </div>
    )
  }

  if (checkingSession) {
    return (
      <main className="account-page section-wrap">
        <p className="api-state" role="status">Checking your account�</p>
      </main>
    )
  }

  if (!customer) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <main className="customer-account-page section-wrap">
      <section className="customer-account-shell">
        <header className="customer-account-heading">
          <div>
            <p className="eyebrow">IKIRA / YOUR ACCOUNT</p>
            <h1>Hello, {customer.fullName}</h1>
            <p>{customer.email}</p>
          </div>
        </header>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="customer-account-layout">
          <nav className="customer-account-nav" aria-label="Your account">
            <Link to="/account" aria-current={section === 'dashboard' ? 'page' : undefined}>Overview</Link>
            {accountSections.map(([key, label, to]) => (
              <Link key={key} to={to} aria-current={section === key ? 'page' : undefined}>{label}</Link>
            ))}
          </nav>
          <section className="customer-account-content" aria-labelledby="customer-account-title">
            <p className="eyebrow">ACCOUNT / {sectionTitle.toUpperCase()}</p>
            <h1 className="customer-account-title" id="customer-account-title">{sectionTitle}</h1>
            {renderSection()}
          </section>
        </div>
      </section>
    </main>
  )
}

export default CustomerAccountPage
