import { useEffect, useState } from 'react'
import { ArrowRight, Heart, Minus, Plus, Star } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ProductCard from '../components/products/ProductCard.jsx'
import useStore from '../context/useStore.js'
import { createProductReview, getProductBySlug, getProductReviews, getProducts } from '../services/products.js'
import { getCustomerSession } from '../services/customerAuth.js'
import './ProductReviews.css'

const galleryViews = [
  { id: 'bottle', label: 'Fragrance bottle' },
  { id: 'petal', label: 'Magnolia petals' },
  { id: 'notes', label: 'Fragrance notes' },
]

function formatDate(date) {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' }).format(new Date(date))
}

function formatPrice(price) {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(price)}`
}

function ProductDetailsPage() {
  const { slug } = useParams()
  const location = useLocation()
  const [product, setProduct] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [requestState, setRequestState] = useState({ key: '', status: 'loading', error: null })
  const [retryCount, setRetryCount] = useState(0)
  const requestKey = `${slug}:${retryCount}`
  const loading =
    requestState.key !== requestKey || requestState.status === 'loading'
  const error =
    requestState.key === requestKey && requestState.status === 'error'
      ? requestState.error
      : null
  const {
    addToCart,
    recentlyViewed,
    recordRecentlyViewed,
    toggleWishlist,
    wishlist,
  } = useStore()
  const navigate = useNavigate()
  const [galleryView, setGalleryView] = useState('bottle')
  const [selectedImage, setSelectedImage] = useState('')
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [addedToBag, setAddedToBag] = useState(false)
  const [reviewCustomer, setReviewCustomer] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewSummary, setReviewSummary] = useState({ rating: 0, count: 0 })
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      getProductBySlug(slug, { signal: controller.signal }),
      getProducts({ limit: 50, sort: 'rating' }, { signal: controller.signal }),
    ])
      .then(([loadedProduct, loadedCatalog]) => {
        setProduct(loadedProduct)
        setCatalog(loadedCatalog.data)
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
  }, [requestKey, slug])

  useEffect(() => {
    if (!product || location.hash !== '#customer-reviews') return
    document.getElementById('customer-reviews')?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash, product])

  useEffect(() => {
    let active = true
    getCustomerSession()
      .then((response) => {
        if (active) setReviewCustomer(response.data.customer)
      })
      .catch(() => {
        if (active) setReviewCustomer(null)
      })
    getProductReviews(slug)
      .then((response) => {
        if (!active) return
        setReviews(response.data)
        setReviewSummary(response.summary)
      })
      .catch((requestError) => {
        if (active) setReviewMessage(requestError.message)
      })
    return () => {
      active = false
    }
  }, [slug])

  async function handleReviewSubmit(event) {
    event.preventDefault()
    setReviewSubmitting(true)
    setReviewMessage('')
    try {
      const response = await createProductReview(slug, reviewForm)
      setReviews((current) => [response.data.review, ...current])
      setReviewSummary(response.data.summary)
      setProduct((current) => current ? {
        ...current,
        rating: response.data.summary.rating,
        reviewCount: response.data.summary.count,
      } : current)
      setReviewForm({ rating: 5, title: '', comment: '' })
      setReviewMessage('Thank you. Your review has been published.')
    } catch (requestError) {
      setReviewMessage(requestError.message)
      if (requestError.status === 401) setReviewCustomer(null)
    } finally {
      setReviewSubmitting(false)
    }
  }
  useEffect(() => {
    if (product?.id) recordRecentlyViewed(product.id)
  }, [product?.id, recordRecentlyViewed])

  if (loading) {
    return (
      <main className="api-state-page section-wrap">
        <div className="api-state" role="status">Loading fragrance details…</div>
      </main>
    )
  }

  if (error && error.status !== 404) {
    return (
      <main className="api-state-page section-wrap">
        <div className="api-state" role="alert">
          <p className="eyebrow">Fragrance unavailable</p>
          <h1>We couldn’t load this fragrance.</h1>
          <p>{error.message}</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="not-found section-wrap">
        <p className="eyebrow">A scent not yet found</p>
        <h1>This fragrance isn’t in the collection.</h1>
        <p>Explore the full collection to find something that feels like you.</p>
        <Link className="hero-cta" to="/shop">
          Explore the collection <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </main>
    )
  }

  const selectedSize = size || product.sizes[0]
  const variant =
    product.variants.find((item) => item.size === selectedSize) ?? product.variants[0]
  const isWishlisted = wishlist.includes(product.id)
  const relatedProducts = catalog.filter((item) => item.id !== product.id).slice(0, 3)
  const productImages = [product.imageUrl, ...(product.galleryImages ?? [])].filter(Boolean)
  const displayedImage = productImages.includes(selectedImage) ? selectedImage : product.imageUrl || product.galleryImages?.[0] || ''
  const recentlyViewedProducts = recentlyViewed
    .filter((id) => id !== product.id)
    .map((id) => catalog.find((item) => item.id === id))
    .filter(Boolean)

  function handleAddToBag() {
    addToCart(product, selectedSize, quantity)
    setAddedToBag(true)
  }

  function handleBuyNow() {
    navigate('/checkout', {
      state: { productId: product.id, size: selectedSize, quantity },
    })
  }

  return (
    <main className="product-detail-page section-wrap">
      <div className="shop-breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </div>

      <section className="product-detail" aria-labelledby="product-title">
        <div className="product-gallery">
          <div
            className={`product-detail-art detail-art-${product.accent} detail-view-${galleryView}${displayedImage ? ' has-product-image' : ''}`}
            role={displayedImage ? undefined : 'img'}
            aria-label={displayedImage ? undefined : `${product.name} product image`}
          >
            {displayedImage ? (
              <img className="product-detail-photo" src={displayedImage} alt={product.name} />
            ) : (
              <>
            <svg className="detail-branch" viewBox="0 0 520 340" fill="none" aria-hidden="true">
              <path d="M15 284C115 229 160 251 236 197C301 151 330 116 397 105C445 97 472 66 506 37" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <path d="M157 239C148 192 122 166 94 149M267 172C267 132 289 106 318 82M386 108C389 69 414 43 441 29" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <g fill="#E9B48F" stroke="#FCF4EA" strokeWidth="3">
                <circle cx="91" cy="143" r="13" /><circle cx="79" cy="138" r="10" /><circle cx="96" cy="128" r="10" /><circle cx="106" cy="143" r="10" />
                <circle cx="319" cy="74" r="14" /><circle cx="306" cy="68" r="10" /><circle cx="323" cy="58" r="10" /><circle cx="333" cy="74" r="10" />
                <circle cx="441" cy="21" r="13" /><circle cx="429" cy="16" r="10" /><circle cx="445" cy="7" r="10" /><circle cx="455" cy="22" r="10" />
              </g>
              <path d="M137 207C117 185 98 190 94 204C109 220 125 220 137 207ZM287 129C268 111 251 117 249 132C263 146 279 143 287 129ZM407 69C392 49 373 52 368 67C381 81 397 83 407 69Z" fill="#829071" />
            </svg>
            <span className="detail-petal detail-petal-one" />
            <span className="detail-petal detail-petal-two" />
            <div className="detail-bottle" aria-hidden="true">
              <span className="detail-bottle-cap" />
              <span className="detail-bottle-neck" />
              <span className="detail-bottle-label">
                <span>IKIRA</span>
                <strong>{product.name.toUpperCase()}</strong>
                <small>{product.concentration.toUpperCase()}</small>
              </span>
            </div>
            <div className="detail-plinth" />
            <span className="detail-art-caption">IKIRA — {product.name}</span>
              </>
            )}
          </div>

          {productImages.length > 1 ? <div className="product-thumbnails" aria-label="Product gallery">
            {productImages.map((imageUrl, index) => (
              <button className={`product-thumbnail${displayedImage === imageUrl ? ' is-selected' : ''}`} key={imageUrl} type="button" aria-label={`Show product image ${index + 1}`} aria-pressed={displayedImage === imageUrl} onClick={() => setSelectedImage(imageUrl)}>
                <img src={imageUrl} alt="" />
              </button>
            ))}
          </div> : !product.imageUrl && <div className="product-thumbnails" aria-label="Product gallery">
            {galleryViews.map((view, index) => (
              <button
                className={`product-thumbnail thumb-${view.id}${galleryView === view.id ? ' is-selected' : ''}`}
                key={view.id}
                type="button"
                aria-label={`Show ${view.label}`}
                aria-pressed={galleryView === view.id}
                onClick={() => setGalleryView(view.id)}
              >
                <span className="thumbnail-orbit" />
                {index === 0 ? (
                  <span className="thumbnail-bottle" />
                ) : (
                  <span className="thumbnail-petal" />
                )}
              </button>
            ))}
          </div>}
        </div>

        <div className="product-purchase">
          <p className="eyebrow">{product.family} · {product.concentration}</p>
          <div className="product-detail-title-row">
            <h1 id="product-title">{product.name}</h1>
            <button
              className={`detail-wishlist${isWishlisted ? ' is-active' : ''}`}
              type="button"
              aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
              aria-pressed={isWishlisted}
              onClick={() => toggleWishlist(product.id)}
            >
              <Heart size={21} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>
          <a className="detail-review-link" href="#customer-reviews">
            <Star size={14} fill="currentColor" aria-hidden="true" />
            <span>{product.rating}</span>
            <span>({product.reviewCount} ratings)</span>
          </a>
          <p className="detail-description">{product.description}</p>

          <p className="detail-price">{formatPrice(variant.price)}</p>
          <p className="detail-sku">SKU: {variant.sku}</p>

          <fieldset className="variant-fieldset">
            <legend>
              Size <span>— {selectedSize}</span>
            </legend>
            <div className="variant-options">
              {product.variants.map((option) => (
                <button
                  className={selectedSize === option.size ? 'variant-option is-selected' : 'variant-option'}
                  key={option.sku}
                  type="button"
                  aria-pressed={selectedSize === option.size}
                  onClick={() => {
                    setSize(option.size)
                    setQuantity(1)
                    setAddedToBag(false)
                  }}
                >
                  <span>{option.size}</span>
                  <small>{formatPrice(option.price)}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <p className={variant.stock > 0 ? 'detail-stock is-available' : 'detail-stock is-unavailable'}>
            <span aria-hidden="true" />
            {variant.stock > 0
              ? `In stock — ${variant.stock} available`
              : 'Currently out of stock'}
          </p>

          <div className="detail-actions">
            <div className="quantity-control" aria-label="Quantity">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus size={15} />
              </button>
              <output aria-live="polite">{quantity}</output>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= variant.stock}
                onClick={() => setQuantity((current) => Math.min(variant.stock, current + 1))}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="detail-add-button"
              type="button"
              disabled={variant.stock < 1}
              onClick={handleAddToBag}
            >
              {addedToBag ? 'Added to Bag' : 'Add to Cart'}
            </button>
          </div>
          <button
            className="detail-buy-button"
            type="button"
            disabled={variant.stock < 1}
            onClick={handleBuyNow}
          >
            Buy Now
          </button>
          {addedToBag && (
            <p className="detail-cart-feedback" role="status">
              {quantity} × {product.name} ({selectedSize}) added to your bag.
            </p>
          )}

          <div className="detail-assurance">
            <span>Thoughtfully composed</span>
            <span>Secure checkout</span>
            <span>Cash on delivery planned</span>
          </div>
        </div>
      </section>

      <section className="product-information" aria-label="Product information">
        <details open>
          <summary>Fragrance notes</summary>
          <div className="detail-accordion-content notes-list">
            {product.notes.map((note, index) => (
              <span key={note}>
                <small>{['01', '02', '03'][index] ?? '•'}</small>
                {note}
              </span>
            ))}
          </div>
        </details>
        <details>
          <summary>Product specifications</summary>
          <dl className="detail-accordion-content specification-list">
            <div><dt>Fragrance family</dt><dd>{product.family}</dd></div>
            <div><dt>Concentration</dt><dd>{product.concentration}</dd></div>
            <div><dt>Selected size</dt><dd>{variant.size}</dd></div>
            <div><dt>SKU</dt><dd>{variant.sku}</dd></div>
          </dl>
        </details>
        <details>
          <summary>Delivery &amp; returns</summary>
          <p className="detail-accordion-content">
            Delivery options, estimated timing, and return eligibility will be
            confirmed at checkout for your destination.
          </p>
        </details>
      </section>

      <section className="customer-reviews" id="customer-reviews">
        <p className="eyebrow">The IKIRA community</p>
        <h2>Notes from those who wear it.</h2>
        <div className="review-summary">
          <Star size={18} fill="currentColor" aria-hidden="true" />
          <strong>{reviewSummary.count ? reviewSummary.rating + ' / 5' : 'No reviews yet'}</strong>
          <span>{reviewSummary.count} customer {reviewSummary.count === 1 ? 'review' : 'reviews'}</span>
        </div>

        {reviewCustomer ? (
          <form className="product-review-form" onSubmit={handleReviewSubmit}>
            <p className="eyebrow">SIGNED IN AS {reviewCustomer.fullName}</p>
            <label>
              Your rating
              <select
                value={reviewForm.rating}
                onChange={(event) => setReviewForm((current) => ({ ...current, rating: Number(event.target.value) }))}
              >
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} out of 5</option>)}
              </select>
            </label>
            <label>
              Review title (optional)
              <input
                maxLength={100}
                value={reviewForm.title}
                onChange={(event) => setReviewForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              Your review
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
              />
            </label>
            <button className="hero-cta" type="submit" disabled={reviewSubmitting}>
              {reviewSubmitting ? 'Publishing�' : 'Submit review'}
            </button>
          </form>
        ) : (
          <div className="product-review-signin">
            <p>Create an IKIRA account and sign in to leave a review.</p>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create account</Link>
          </div>
        )}

        {reviewMessage && <p className="product-review-message" role="status">{reviewMessage}</p>}
        <div className="product-review-list">
          {reviews.map((review) => (
            <article className="product-review-card" key={review.id}>
              <div className="product-review-meta">
                <strong>{review.customerName}</strong>
                <span>{formatDate(review.createdAt)}</span>
                <span>{review.rating} / 5</span>
              </div>
              {review.title && <h3>{review.title}</h3>}
              <p>{review.comment}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="related-products">
        <div className="related-heading">
          <div>
            <p className="eyebrow">A few kindred notes</p>
            <h2>Continue exploring.</h2>
          </div>
          <Link className="text-link" to="/shop">
            View all fragrances <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="related-grid">
          {relatedProducts.map((related) => (
            <ProductCard key={related.id} product={related} />
          ))}
        </div>
      </section>

      {recentlyViewedProducts.length > 0 && (
        <section className="related-products recently-viewed">
          <div className="related-heading">
            <div>
              <p className="eyebrow">Your recent discoveries</p>
              <h2>Recently viewed.</h2>
            </div>
          </div>
          <div className="related-grid">
            {recentlyViewedProducts.map((recentlyViewedProduct) => (
              <ProductCard key={recentlyViewedProduct.id} product={recentlyViewedProduct} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

export default ProductDetailsPage
