import { useEffect, useRef, useState } from 'react'
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react'
import gsap from 'gsap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useStore from '../../context/useStore.js'
import { deleteCustomerSession, getCustomerSession } from '../../services/customerAuth.js'
import { deleteAdminSession, getAdminSession } from '../../services/products.js'
import ThemeToggle from './ThemeToggle.jsx'
import AccountDropdown from './AccountDropdown.jsx'

const links = [
  { label: 'Home', to: '/#home' },
  { label: 'Collections', to: '/#collections' },
  { label: 'Shop', to: '/shop' },
  { label: 'Contact Us', to: '/#contact' },
]

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customer, setCustomer] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [accountError, setAccountError] = useState('')
  const headerRef = useRef(null)
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const customerSessionRevision = useRef(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { cartCount, wishlist } = useStore()

  useEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.fromTo(
        '[data-header-reveal]',
        { opacity: 0, y: -8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.08,
          ease: 'power2.out',
          clearProps: 'all',
        },
      )
    }, headerRef)

    return () => context.revert()
  }, [])

  useEffect(() => {
    if (
      menuOpen &&
      menuRef.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' },
      )
    }
  }, [menuOpen])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    let active = true

    function handleCustomerSessionChange(event) {
      customerSessionRevision.current += 1
      setCustomer(event.detail?.customer ?? null)
      setAccountError('')
    }

    window.addEventListener('ikira:customer-session', handleCustomerSessionChange)
    const requestRevision = customerSessionRevision.current
    getCustomerSession()
      .then((response) => {
        if (active && customerSessionRevision.current === requestRevision) {
          setCustomer(response.data.customer)
            }
      })
      .catch((error) => {
        if (!active || customerSessionRevision.current !== requestRevision) return
        if (error.status === 401) {
          setCustomer(null)
        } else {
          setCustomer(null)
          console.error('Unable to check the customer session.', error)
        }
      })

    return () => {
      active = false
      window.removeEventListener('ikira:customer-session', handleCustomerSessionChange)
    }
  }, [location.pathname])

  useEffect(() => {
    let active = true

    getAdminSession()
      .then((response) => {
        if (active) setAdmin(response.data)
      })
      .catch((error) => {
        if (!active) return
        setAdmin(null)
        if (error.status !== 401) console.error('Unable to check the admin session.', error)
      })
      .finally(() => {

      })

    return () => {
      active = false
    }
  }, [location.pathname])
  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleCustomerSignOut() {
    setAccountError('')
    try {
      await deleteCustomerSession()
      setCustomer(null)
      setMenuOpen(false)
      window.dispatchEvent(new CustomEvent('ikira:customer-session', {
        detail: { customer: null },
      }))
      navigate('/login')
    } catch (error) {
      setAccountError(error.message)
    }
  }


  async function handleAdminLogout() {
    setAccountError('')
    try {
      await deleteAdminSession()
      setAdmin(null)

      setMenuOpen(false)
      navigate('/login')
    } catch (error) {
      setAccountError(error.message)
    }
  }

  return (
    <header className="site-header" ref={headerRef}>
      <div className="header-inner">
        <Link className="brand" to="/#home" aria-label="IKIRA, home" data-header-reveal>
          Ikira
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation" data-header-reveal>
          {links.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions" data-header-reveal>
          <ThemeToggle />
          <button
            className="icon-button search-toggle"
            type="button"
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
          <AccountDropdown customer={admin ? null : customer} admin={admin} error={accountError} onLogout={admin ? handleAdminLogout : handleCustomerSignOut} />
          <Link
            className="icon-button wishlist-action"
            to="/wishlist"
            aria-label={`Wishlist, ${wishlist.length} saved items`}
          >
            <Heart size={19} />
            {wishlist.length > 0 && <span className="wishlist-count">{wishlist.length}</span>}
          </Link>
          <Link className="icon-button bag-action" to="/cart" aria-label={`Shopping bag, ${cartCount} items`}>
            <ShoppingBag size={19} />
            <span className="bag-count">{cartCount}</span>
          </Link>
          <button
            className="icon-button menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form
          className="search-panel"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            setSearchOpen(false)
            const query = searchQuery.trim()
            navigate(query ? `/shop?search=${encodeURIComponent(query)}` : '/shop')
          }}
        >
          <Search aria-hidden="true" size={18} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search fragrances"
            placeholder="Search fragrances"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      )}

      {menuOpen && (
        <nav
          className="mobile-nav"
          aria-label="Mobile navigation"
          ref={menuRef}
        >
          {links.map((link) => (
            <Link key={link.to} to={link.to} onClick={closeMenu}>
              {link.label}
            </Link>
          ))}
          <Link to="/wishlist" onClick={closeMenu}>Wishlist ({wishlist.length})</Link>
          <ThemeToggle variant="mobile" />
        </nav>
      )}
    </header>
  )
}

export default Header
