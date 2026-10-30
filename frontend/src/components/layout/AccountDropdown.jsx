import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Heart,
  LockKeyhole,
  LogOut,
  MapPin,
  Package,
  Truck,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import './AccountDropdown.css'

const customerLinks = [
  { label: 'My Profile', to: '/account/profile', Icon: UserRound },
  { label: 'My Orders', to: '/account/orders', Icon: Package },
  { label: 'Track My Order', to: '/account/track-order', Icon: Truck },
  { label: 'My Wishlist', to: '/wishlist', Icon: Heart },
  { label: 'My Addresses', to: '/account/addresses', Icon: MapPin },
  { label: 'Account Settings', to: '/account/settings', Icon: LockKeyhole },
]

function AccountDropdown({ customer, admin, error, onLogout }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const firstItemRef = useRef(null)
  const closeTimer = useRef(null)
  const signedIn = Boolean(customer || admin)

  function closeMenu({ restoreFocus = false } = {}) {
    if (!open || closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
      if (restoreFocus) triggerRef.current?.focus()
    }, 150)
  }

  function toggleMenu() {
    if (open && !closing) {
      closeMenu()
      return
    }
    window.clearTimeout(closeTimer.current)
    setClosing(false)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) closeMenu()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu({ restoreFocus: true })
        return
      }

      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = wrapperRef.current?.querySelectorAll('[data-account-item]')
      if (!items?.length) return

      event.preventDefault()
      const currentIndex = Array.from(items).indexOf(document.activeElement)
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex <= 0 ? items.length : currentIndex) - 1
      items[nextIndex]?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, closing])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  function handleLogout() {
    window.clearTimeout(closeTimer.current)
    setOpen(false)
    setClosing(false)
    onLogout()
  }

  const accountLink = admin ? '/admin?section=settings' : '/account'

  return (
    <div className="account-dropdown" ref={wrapperRef}>
      <button
        className="icon-button account-action"
        type="button"
        aria-label="Account options"
        aria-expanded={open && !closing}
        aria-haspopup="true"
        aria-controls="account-dropdown-panel"
        onClick={toggleMenu}
        ref={triggerRef}
      >
        <UserRound size={19} aria-hidden="true" />
      </button>

      {open && (
        <section
          id="account-dropdown-panel"
          className={'account-dropdown-panel' + (closing ? ' is-closing' : '')}
          aria-label={signedIn ? 'Account menu' : 'Sign in to IKIRA'}
        >
          {signedIn ? (
            <>
              <div className="account-dropdown-identity">
                <span className="account-dropdown-eyebrow">YOUR IKIRA ACCOUNT</span>
                <strong>Hello, {customer?.fullName || admin?.username}</strong>
                {customer?.email && <span className="account-dropdown-email">{customer.email}</span>}
                {admin && <span className="account-dropdown-email">Store administrator</span>}
                <Link
                  className="account-dropdown-view"
                  to={accountLink}
                  data-account-item
                  ref={firstItemRef}
                  onClick={() => closeMenu()}
                >
                  View My Account <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {admin ? (
                <nav className="account-dropdown-links" aria-label="Admin account">
                  <Link to={accountLink} data-account-item onClick={() => closeMenu()}>
                    <LockKeyhole size={17} aria-hidden="true" /><span>Account Settings</span>
                  </Link>
                </nav>
              ) : (
                <nav className="account-dropdown-links" aria-label="Customer account">
                  {customerLinks.map(({ label, to, Icon }) => (
                    <Link key={to} to={to} data-account-item onClick={() => closeMenu()}>
                      <Icon size={17} aria-hidden="true" /><span>{label}</span>
                    </Link>
                  ))}
                </nav>
              )}

              <div className="account-dropdown-footer">
                {error && <p className="account-dropdown-error" role="alert">{error}</p>}
                <button type="button" data-account-item onClick={handleLogout}>
                  <LogOut size={17} aria-hidden="true" /> Logout
                </button>
              </div>
            </>
          ) : (
            <div className="account-dropdown-guest">
              <span className="account-dropdown-eyebrow">WELCOME TO IKIRA</span>
              <strong>Discover your signature scent.</strong>
              <Link to="/login" data-account-item ref={firstItemRef} onClick={() => closeMenu()}>
                Sign In
              </Link>
              <Link to="/register" data-account-item onClick={() => closeMenu()}>
                Create Account
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default AccountDropdown
