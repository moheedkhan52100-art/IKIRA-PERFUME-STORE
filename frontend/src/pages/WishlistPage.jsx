import { useEffect, useState } from 'react'
import { ArrowRight, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/products/ProductCard.jsx'
import useStore from '../context/useStore.js'
import { getProductBySlug } from '../services/products.js'

function WishlistPage() {
  const { wishlist } = useStore()
  const [products, setProducts] = useState([])
  const [requestState, setRequestState] = useState({ key: '', status: 'idle', error: '' })
  const [retryCount, setRetryCount] = useState(0)
  const wishlistKey = wishlist.join('|')
  const requestKey = `${wishlistKey}:${retryCount}`

  useEffect(() => {
    if (wishlist.length === 0) {
      setProducts([])
      setRequestState({ key: requestKey, status: 'loaded', error: '' })
      return undefined
    }

    const controller = new AbortController()
    setRequestState({ key: requestKey, status: 'loading', error: '' })
    Promise.all(
      wishlist.map((productId) => getProductBySlug(productId, { signal: controller.signal })),
    )
      .then((savedProducts) => {
        setProducts(savedProducts)
        setRequestState({ key: requestKey, status: 'loaded', error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setRequestState({
            key: requestKey,
            status: 'error',
            error: error.message || 'Your wishlist could not be loaded.',
          })
        }
      })

    return () => controller.abort()
  }, [requestKey, wishlist, wishlistKey])

  const loading = requestState.key !== requestKey || requestState.status === 'loading'
  const error = requestState.key === requestKey && requestState.status === 'error'
    ? requestState.error
    : ''

  return (
    <main className="wishlist-page section-wrap">
      <header className="wishlist-heading">
        <p className="eyebrow">Kept close</p>
        <h1>Your wishlist.</h1>
        <p>Fragrances you’ve saved for another look.</p>
      </header>

      {loading && <p className="api-state" role="status">Loading saved fragrances…</p>}
      {error && (
        <div className="wishlist-error">
          <p className="admin-error" role="alert">{error}</p>
          <button className="admin-secondary-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && products.length > 0 && (
        <div className="product-grid wishlist-grid">
          {products
            .filter((product) => wishlist.includes(product.id))
            .map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
      {!loading && !error && products.length === 0 && (
        <section className="wishlist-empty">
          <Heart size={28} aria-hidden="true" />
          <h2>Your wishlist is empty.</h2>
          <p>Tap the heart on a fragrance to save it here.</p>
          <Link className="hero-cta" to="/shop">
            Explore the collection <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}
    </main>
  )
}

export default WishlistPage
