import { useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import useStore from '../../context/useStore.js'
import './CartToast.css'

function CartToast() {
  const { cartNotice, dismissCartNotice } = useStore()

  useEffect(() => {
    if (!cartNotice) return undefined
    const timeout = window.setTimeout(dismissCartNotice, 2800)
    return () => window.clearTimeout(timeout)
  }, [cartNotice, dismissCartNotice])

  if (!cartNotice) return null

  return (
    <aside className="cart-toast" role="status" aria-live="polite">
      <span className="cart-toast-check"><Check size={17} aria-hidden="true" /></span>
      <span className="cart-toast-copy">
        <strong>Added to bag</strong>
        <small>{cartNotice.productName}</small>
      </span>
      <Link to="/cart" onClick={dismissCartNotice}>View bag</Link>
      <button type="button" aria-label="Dismiss message" onClick={dismissCartNotice}>
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  )
}

export default CartToast
