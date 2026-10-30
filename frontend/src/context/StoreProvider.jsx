import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StoreContext from './storeContext.js'

const cartStorageKey = 'ikira-cart-v1'
const wishlistStorageKey = 'ikira-wishlist-v1'

function readStoredWishlist() {
  try {
    const savedWishlist = window.localStorage.getItem(wishlistStorageKey)
    if (!savedWishlist) return []
    const parsedWishlist = JSON.parse(savedWishlist)
    return Array.isArray(parsedWishlist) && parsedWishlist.every((id) => typeof id === 'string')
      ? [...new Set(parsedWishlist)]
      : []
  } catch {
    return []
  }
}

function readStoredCart() {
  try {
    const savedCart = window.localStorage.getItem(cartStorageKey)
    if (!savedCart) return []

    const parsedCart = JSON.parse(savedCart)
    if (
      Array.isArray(parsedCart) &&
      parsedCart.every(
        (item) =>
          item?.product?.id &&
          item?.product?.variants?.some((variant) => variant.size === item.size) &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      )
    ) {
      return parsedCart
    }

    throw new Error('The saved cart has an invalid format.')
  } catch (error) {
    console.error('The saved cart could not be restored.', error)
    return []
  }
}

function StoreProvider({ children }) {
  const [cart, setCart] = useState(readStoredCart)
  const [wishlist, setWishlist] = useState(readStoredWishlist)
  const [cartNotice, setCartNotice] = useState(null)
  const cartNoticeSerial = useRef(0)
  const [recentlyViewed, setRecentlyViewed] = useState([])

  const addToCart = useCallback((product, size, quantity = 1) => {
    const variant = product.variants.find((item) => item.size === size)
    if (!variant || variant.stock < 1) return

    setCart((items) => {
      const existingItem = items.find(
        (item) => item.product.id === product.id && item.size === size,
      )

      if (existingItem) {
        return items.map((item) =>
          item === existingItem
            ? { ...item, product, quantity: Math.min(variant.stock, item.quantity + quantity) }
            : item,
        )
      }

      return [...items, { product, size, quantity: Math.min(variant.stock, quantity) }]
    })
    cartNoticeSerial.current += 1
    setCartNotice({ id: cartNoticeSerial.current, productName: product.name })
  }, [])

  const dismissCartNotice = useCallback(() => setCartNotice(null), [])

  const updateCartQuantity = useCallback((productId, size, quantity) => {
    setCart((items) =>
      items.flatMap((item) => {
        if (item.product.id !== productId || item.size !== size) return [item]
        if (quantity < 1) return []

        const variant = item.product.variants.find((option) => option.size === size)
        return variant && variant.stock > 0
          ? [{ ...item, quantity: Math.min(quantity, variant.stock) }]
          : []
      }),
    )
  }, [])

  const removeFromCart = useCallback((productId, size) => {
    setCart((items) =>
      items.filter((item) => item.product.id !== productId || item.size !== size),
    )
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const toggleWishlist = useCallback((productId) => {
    setWishlist((items) =>
      items.includes(productId)
        ? items.filter((item) => item !== productId)
        : [...items, productId],
    )
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart))
    } catch (error) {
      console.error('The shopping cart could not be saved.', error)
    }
  }, [cart])

  useEffect(() => {
    try {
      window.localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist))
    } catch (error) {
      console.error('The wishlist could not be saved.', error)
    }
  }, [wishlist])

  const recordRecentlyViewed = useCallback((productId) => {
    setRecentlyViewed((items) => [
      productId,
      ...items.filter((item) => item !== productId),
    ].slice(0, 8))
  }, [])

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const store = useMemo(
    () => ({
      addToCart,
      cartCount,
      cart,
      cartNotice,
      dismissCartNotice,
      clearCart,
      recentlyViewed,
      recordRecentlyViewed,
      removeFromCart,
      toggleWishlist,
      updateCartQuantity,
      wishlist,
    }),
    [
      addToCart,
      cart,
      cartCount,
      clearCart,
      cartNotice,
      dismissCartNotice,
      recentlyViewed,
      recordRecentlyViewed,
      removeFromCart,
      toggleWishlist,
      updateCartQuantity,
      wishlist,
    ],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export default StoreProvider
