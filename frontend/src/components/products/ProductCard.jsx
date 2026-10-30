import { useEffect, useRef, useState } from 'react'
import { Check, Heart, Star, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import useStore from '../../context/useStore.js'

function formatPrice(price) {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(price)}`
}

function QuickView({ product, onClose }) {
  const dialogRef = useRef(null)
  const [size, setSize] = useState(product.sizes[0])
  const { addToCart } = useStore()
  const selectedVariant = product.variants.find((variant) => variant.size === size)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      className="quick-view-dialog"
      ref={dialogRef}
      aria-labelledby={`quick-view-${product.id}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close()
      }}
    >
      <div className="quick-view-content">
        <div
          className={`product-art product-art-${product.accent}${product.imageUrl ? ' has-product-image' : ''}`}
          aria-hidden="true"
        >
          {product.imageUrl ? (
            <img className="product-card-image" src={product.imageUrl} alt="" loading="lazy" />
          ) : (
            <>
              <span className="product-art-orbit" />
              <span className="product-bottle">
                <span className="product-bottle-cap" />
                <span className="product-bottle-label">IKIRA</span>
              </span>
            </>
          )}
        </div>
        <div className="quick-view-copy">
          <p className="eyebrow">{product.family}</p>
          <h2 id={`quick-view-${product.id}`}>{product.name}</h2>
          <p className="product-concentration">{product.concentration}</p>
          <p>{product.description}</p>
          <p className="quick-view-notes">
            <strong>Fragrance notes</strong>
            <span>{product.notes.join(' Â· ')}</span>
          </p>
          <Link className="quick-view-rating" to={`/product/${product.id}#customer-reviews`} aria-label={`Read or write reviews for ${product.name}`}>
            <Star size={15} fill="currentColor" aria-hidden="true" />
            {product.rating} ({product.reviewCount} reviews · read or write)
          </Link>
          <label className="size-select-label" htmlFor={`quick-size-${product.id}`}>
            Bottle size
          </label>
          <select
            id={`quick-size-${product.id}`}
            value={size}
            onChange={(event) => setSize(event.target.value)}
          >
            {product.sizes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="quick-view-stock">
            {selectedVariant.stock > 0
              ? `${selectedVariant.stock} available`
              : 'Currently out of stock'}
          </p>
          <p className="quick-view-price">{formatPrice(selectedVariant.price)}</p>
          <button
            className="product-add-button"
            type="button"
            disabled={selectedVariant.stock < 1}
            onClick={() => {
              addToCart(product, size)
              dialogRef.current.close()
            }}
          >
            {selectedVariant.stock > 0 ? 'Add to Bag' : 'Currently Unavailable'}
          </button>
          <p className="quick-view-policies">
            Complimentary delivery on orders over Rs. 20,000 Â· Easy returns
            within 14 days.
          </p>
        </div>
      </div>
      <button
        className="quick-view-close"
        type="button"
        aria-label="Close quick view"
        onClick={() => dialogRef.current.close()}
      >
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </dialog>
  )
}

function ProductCard({ product }) {
  const { addToCart, toggleWishlist, wishlist } = useStore()
  const [size, setSize] = useState(product.sizes[0])
  const [addedToBag, setAddedToBag] = useState(false)
  const isWishlisted = wishlist.includes(product.id)
  const selectedVariant = product.variants.find((variant) => variant.size === size)

  return (
    <article className="product-card">
      <div
        className={`product-art product-art-${product.accent}${product.imageUrl ? ' has-product-image' : ''}`}
      >
        {product.imageUrl ? (
          <img className="product-card-image" src={product.imageUrl} alt="" loading="lazy" />
        ) : (
          <>
            <span className="product-art-orbit" />
            <span className="product-art-leaf product-art-leaf-one" />
            <span className="product-art-leaf product-art-leaf-two" />
            <span className="product-bottle">
              <span className="product-bottle-cap" />
              <span className="product-bottle-label">IKIRA</span>
            </span>
          </>
        )}
        {product.isNew && <span className="product-badge">New</span>}
        {!product.available && <span className="product-badge badge-sold-out">Sold out</span>}
        <button
          className={`product-wishlist${isWishlisted ? ' is-active' : ''}`}
          type="button"
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={isWishlisted}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
        <Link
          className="product-quick-view"
          to={`/product/${product.id}`}
        >
          Quick view
        </Link>
      </div>

      <div className="product-info">
        <div className="product-title-row">
          <div>
            <h2>
              <Link to={`/product/${product.id}`}>{product.name}</Link>
            </h2>
            <p className="product-family">{product.family}</p>
          </div>
          <p className="product-price">{formatPrice(selectedVariant.price)}</p>
        </div>
        <div className="product-rating">
          <Star size={13} fill="currentColor" aria-hidden="true" />
          <span>{product.rating}</span>
          <span className="rating-count">({product.reviewCount})</span>
          <span className="product-concentration">{product.concentration}</span>
        </div>
        <div className="product-sizes" aria-label={`${product.name} bottle sizes`}>
          {product.sizes.map((option) => (
            <button
              className={size === option ? 'size-chip is-selected' : 'size-chip'}
              key={option}
              type="button"
              aria-pressed={size === option}
              onClick={() => {
                setSize(option)
                setAddedToBag(false)
              }}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          className="product-add-button"
          type="button"
          disabled={selectedVariant.stock < 1}
          onClick={() => {
            addToCart(product, size)
            setAddedToBag(true)
          }}
        >
          {selectedVariant.stock > 0 ? (
            <>
              {addedToBag ? (
                <>
                  <Check size={15} aria-hidden="true" />
                  Added to Bag
                </>
              ) : (
                'Add to Bag'
              )}
            </>
          ) : (
            'Currently Unavailable'
          )}
        </button>
      </div>
    </article>
  )
}

export default ProductCard
