import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import useStore from '../context/useStore.js'

function formatPrice(price) {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(price)}`
}

function CartPage() {
  const { cart, removeFromCart, updateCartQuantity } = useStore()
  const subtotal = cart.reduce((total, item) => {
    const variant = item.product.variants.find((option) => option.size === item.size)
    return total + (variant?.price ?? 0) * item.quantity
  }, 0)

  if (cart.length === 0) {
    return (
      <main className="cart-page section-wrap">
        <p className="eyebrow">Your bag</p>
        <div className="cart-empty">
          <h1>A little room for something lovely.</h1>
          <p>Your bag is empty. Find a fragrance to make it yours.</p>
          <Link className="hero-cta" to="/shop">Explore the collection</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="cart-page section-wrap">
      <p className="eyebrow">Your bag</p>
      <h1>Considered, and collected.</h1>
      <div className="cart-layout">
        <section className="cart-items" aria-label="Items in your bag">
          {cart.map(({ product, size, quantity }) => {
            const variant = product.variants.find((option) => option.size === size)
            if (!variant) return null

            return (
              <article className="cart-item" key={`${product.id}:${size}`}>
                <div className={`cart-item-art product-art-${product.accent}`} aria-hidden="true">
                  <span className="product-bottle">
                    <span className="product-bottle-cap" />
                    <span className="product-bottle-label">IKIRA</span>
                  </span>
                </div>
                <div className="cart-item-details">
                  <p className="eyebrow">{product.concentration}</p>
                  <h2>{product.name}</h2>
                  <p>{size} · {formatPrice(variant.price)}</p>
                  <div className="cart-item-actions">
                    <div className="quantity-control" aria-label={`${product.name} quantity`}>
                      <button
                        type="button"
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => updateCartQuantity(product.id, size, quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <output aria-live="polite">{quantity}</output>
                      <button
                        type="button"
                        aria-label={`Add one ${product.name}`}
                        disabled={quantity >= variant.stock}
                        onClick={() => updateCartQuantity(product.id, size, quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="cart-remove-button"
                      type="button"
                      onClick={() => removeFromCart(product.id, size)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
                <strong className="cart-line-total">
                  {formatPrice(variant.price * quantity)}
                </strong>
              </article>
            )
          })}
        </section>

        <aside className="cart-summary" aria-label="Order summary">
          <p className="eyebrow">Order summary</p>
          <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
          <div><span>Delivery</span><strong>Free</strong></div>
          <div className="cart-summary-total"><span>Total</span><strong>{formatPrice(subtotal)}</strong></div>
          <p>Free delivery for initial cash-on-delivery orders. Prices and availability are verified at checkout.</p>
          <Link className="hero-cta" to="/checkout">Continue to checkout</Link>
          <Link className="cart-continue-link" to="/shop">Continue exploring</Link>
        </aside>
      </div>
    </main>
  )
}

export default CartPage
