import { useEffect } from 'react'
import { ArrowDownRight, ArrowRight } from 'lucide-react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import CartToast from './components/layout/CartToast.jsx'
import Hero from './components/home/Hero.jsx'
import CollectionGrid from './components/home/CollectionGrid.jsx'
import ShopPage from './pages/ShopPage.jsx'
import ProductDetailsPage from './pages/ProductDetailsPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import CartPage from './pages/CartPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import CustomerAccountPage from './pages/CustomerAccountPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'
import StoreChatbot from './components/StoreChatbot.jsx'
import LoginPage from './pages/LoginPage.jsx'
import discoveryImage from '../../images/store image/discovery sets.webp'
import './App.css'

function HomePage() {
  return (
    <main>
      <Hero />

      <section className="story section-wrap" id="about">
        <p className="eyebrow">A study in contrasts</p>
        <div className="story-content">
          <h2>
            Nature, captured
            <br />
            in a moment.
          </h2>
          <div className="story-copy">
            <p>
              IKIRA creates considered fragrances inspired by the beauty of
              the natural world. Each scent is an invitation to slow down,
              look closer, and leave a little room for wonder.
            </p>
            <Link className="text-link" to="/#collections">
              Our point of view <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
        <ArrowDownRight className="story-mark" aria-hidden="true" />
      </section>

      <CollectionGrid />

      <section className="collection section-wrap" id="shop">
        <div className="collection-heading">
          <p className="eyebrow">The inaugural fragrance</p>
          <span className="collection-index">01 — 03</span>
        </div>
        <div className="collection-card">
          <div className="collection-art">
            <img
              className="collection-image"
              src={discoveryImage}
              alt="IKIRA Discovery Sets perfume bottles"
              loading="lazy"
            />
          </div>
          <div className="collection-details">
            <p className="eyebrow">01 / Eau de parfum</p>
            <h2>Peachwood</h2>
            <p className="collection-description">
              Ripe peach, magnolia petals and the quiet warmth of sunlit
              woods. A soft glow that lingers long after the day has ended.
            </p>
            <Link className="text-link" to="/product/peachwood">
              Discover the fragrance <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="not-found section-wrap">
      <p className="eyebrow">A quiet detour</p>
      <h1>We couldn’t find that page.</h1>
      <p>The page may have moved, or the address may be mistyped.</p>
      <Link className="hero-cta" to="/">
        Return to IKIRA
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </main>
  )
}

function App() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.hash])

  return (
    <>
      {!isAdminRoute && <Header />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/product/:slug"
          element={<ProductDetailsPage key={location.pathname} />}
        />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/account" element={<CustomerAccountPage />} />
        <Route path="/account/profile" element={<CustomerAccountPage />} />
        <Route path="/account/orders" element={<CustomerAccountPage />} />
        <Route path="/account/track-order" element={<CustomerAccountPage />} />
        <Route path="/account/addresses" element={<CustomerAccountPage />} />
        <Route path="/account/settings" element={<CustomerAccountPage />} />
        <Route path="/account/reviews" element={<CustomerAccountPage />} />
        <Route path="/account/preferences" element={<CustomerAccountPage />} />
        <Route path="/account/rewards" element={<CustomerAccountPage />} />
        <Route path="/account/support" element={<CustomerAccountPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage initialMode="register" />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/login" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <StoreChatbot />}
      {!isAdminRoute && <CartToast />}
    </>
  )
}

export default App
