import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate } from 'react-router-dom'
import {
  Activity,
  Boxes,
  CirclePlus,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Star,
  TicketPercent,
  Users,
  X,
} from 'lucide-react'
import ThemeToggle from '../components/layout/ThemeToggle.jsx'
import './AdminPromotions.css'
import {
  createAdminProduct,
  createAdminCategory,
  createAdminPromotion,
  deleteAdminCategory,
  deleteAdminPromotion,
  deleteAdminProductImage,
  deleteAdminProductGalleryImage,
  deleteAdminSession,
  getAdminCustomers,
  getAdminActivity,
  getAdminCategories,
  getAdminOrder,
  getAdminOrders,
  getAdminOverview,
  getAdminProducts,
  getAdminPromotions,
  getAdminReviews,
  getAdminSession,
  updateAdminOrderStatus,
  updateAdminOrderItemStatus,
  updateAdminPromotionStatus,
  updateAdminProductInventory,
  updateAdminProductVisibility,
  uploadAdminProductImage,
} from '../services/products.js'

const statusOptions = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']
const transitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}
const itemStatusTransitions = {
  placed: ['confirmed'],
  confirmed: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

function formatPrice(price) {
  return `Rs. ${new Intl.NumberFormat('en-PK').format(price)}`
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function AdminPage() {
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).get('section') === 'settings' ? 'settings' : 'dashboard')
  const [admin, setAdmin] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState('')
  const [orders, setOrders] = useState([])
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [pagination, setPagination] = useState({ pages: 0, total: 0 })
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [ordersLoadedKey, setOrdersLoadedKey] = useState('')
  const [actionInProgress, setActionInProgress] = useState('')
  const [ordersError, setOrdersError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [overview, setOverview] = useState(null)
  const [activity, setActivity] = useState([])
  const [activityLoadedKey, setActivityLoadedKey] = useState('')
  const [activityError, setActivityError] = useState('')
  const [customers, setCustomers] = useState([])
  const [managedCategories, setManagedCategories] = useState([])
  const [promotions, setPromotions] = useState([])
  const [adminReviews, setAdminReviews] = useState([])
  const [adminReviewsError, setAdminReviewsError] = useState('')
  const [promotionForm, setPromotionForm] = useState({
    code: '',
    category: 'coupon',
    discountType: 'percent',
    discountValue: '10',
    minimumSubtotal: '0',
    usageLimit: '',
    startsAt: '',
    endsAt: '',
  })
  const [categoryName, setCategoryName] = useState('')
  const [products, setProducts] = useState([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogPages, setCatalogPages] = useState(1)
  const [catalogError, setCatalogError] = useState('')
  const [productsLoadedKey, setProductsLoadedKey] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [productSearch, setProductSearch] = useState('')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const [catalogBusy, setCatalogBusy] = useState(false)
  const catalogBusyRef = useRef(catalogBusy)
  catalogBusyRef.current = catalogBusy
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [newProductFrontImage, setNewProductFrontImage] = useState(null)
  const [newProductGalleryImages, setNewProductGalleryImages] = useState([])
  const [editingFacetsSlug, setEditingFacetsSlug] = useState('')
  const [productForm, setProductForm] = useState({
    name: '',
    family: '',
    gender: 'unisex',
    category: 'unisex',
    concentration: 'Eau de Parfum',
    price: '',
    sizes: '30 ml, 50 ml',
    stock: '10',
    description: '',
    notes: '',
    collection: 'signature',
  })
  const [stockEdits, setStockEdits] = useState({})
  const [priceEdits, setPriceEdits] = useState({})
  const [genderEdits, setGenderEdits] = useState({})
  const [collectionEdits, setCollectionEdits] = useState({})
  const [familyEdits, setFamilyEdits] = useState({})
  const [concentrationEdits, setConcentrationEdits] = useState({})
  const [sizeEdits, setSizeEdits] = useState({})
  const [newSizeEdits, setNewSizeEdits] = useState({})
  const [imageFiles, setImageFiles] = useState({})
  const [imagePreviews, setImagePreviews] = useState({})
  const [galleryImageFiles, setGalleryImageFiles] = useState({})
  const [uploadingImageSlug, setUploadingImageSlug] = useState('')
  const ordersRequestKey = admin
    ? `${admin.username}:${page}:${statusFilter}:${refreshKey}`
    : ''
  const loading = Boolean(admin && ordersLoadedKey !== ordersRequestKey)
  const productsRequestKey = admin
    ? `${admin.username}:${productPage}:${productSearch}:${collectionFilter}:${availabilityFilter}:${refreshKey}`
    : ''
  const productsLoading = Boolean(admin && productsLoadedKey !== productsRequestKey)
  const activityRequestKey = admin && section === 'activity'
    ? `${admin.username}:${refreshKey}`
    : ''
  const activityLoading = Boolean(
    admin && section === 'activity' && activityLoadedKey !== activityRequestKey,
  )

  useEffect(() => () => {
    Object.values(imagePreviews).forEach((preview) => URL.revokeObjectURL(preview))
  }, [imagePreviews])

  useEffect(() => {
    if (!productFormOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !catalogBusyRef.current) setProductFormOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [productFormOpen])

  useEffect(() => {
    let active = true
    getAdminSession()
      .then((response) => {
        if (active) setAdmin(response.data)
      })
      .catch((error) => {
        if (active && error.status !== 401) setAuthError(error.message)
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!admin) return undefined

    let active = true
    getAdminOrders({ page, status: statusFilter })
      .then((response) => {
        if (!active) return
        setOrders(response.data)
        setPagination(response.pagination)
        setOrdersLoadedKey(ordersRequestKey)
      })
      .catch((error) => {
        if (!active) return
        setOrdersLoadedKey(ordersRequestKey)
        if (error.status === 401) {
          setAdmin(null)
          setAuthError('Your admin session has expired. Sign in again.')
        } else {
          setOrdersError(error.message)
        }
      })

    return () => {
      active = false
    }
  }, [admin, ordersRequestKey, page, statusFilter])

  useEffect(() => {
    if (!admin) return undefined

    let active = true
    Promise.all([getAdminOverview(), getAdminCustomers(), getAdminCategories()])
      .then(([overviewResponse, customersResponse, categoriesResponse]) => {
        if (!active) return
        setOverview(overviewResponse.data)
        setCustomers(customersResponse.data)
        setManagedCategories(categoriesResponse.data)
      })
      .catch((error) => {
        if (!active) return
        if (error.status === 401) {
          setAdmin(null)
          setAuthError('Your admin session has expired. Sign in again.')
        } else {
          setCatalogError(error.message)
        }
      })

    return () => {
      active = false
    }
  }, [admin, refreshKey])

  useEffect(() => {
    if (!admin || section !== 'activity') return undefined

    let active = true
    getAdminActivity()
      .then((response) => {
        if (!active) return
        setActivity(response.data)
        setActivityError('')
        setActivityLoadedKey(activityRequestKey)
      })
      .catch((error) => {
        if (!active) return
        setActivityLoadedKey(activityRequestKey)
        if (error.status === 401) {
          setAdmin(null)
          setAuthError('Your admin session has expired. Sign in again.')
        } else {
          setActivityError(error.message)
        }
      })

    return () => {
      active = false
    }
  }, [admin, section, activityRequestKey])

  useEffect(() => {
    if (!admin || section !== 'promotions') return undefined
    let active = true
    getAdminPromotions()
      .then((response) => {
        if (active) setPromotions(response.data)
      })
      .catch((error) => {
        if (!active) return
        if (error.status === 401) {
          setAdmin(null)
          setAuthError('Your admin session has expired. Sign in again.')
        } else {
          setCatalogError(error.message)
        }
      })
    return () => { active = false }
  }, [admin, section, refreshKey])

  useEffect(() => {
    if (!admin || section !== 'reviews') return undefined
    let active = true
    getAdminReviews()
      .then((response) => {
        if (!active) return
        setAdminReviews(response.data)
        setAdminReviewsError('')
      })
      .catch((error) => {
        if (!active) return
        if (error.status === 401) {
          setAdmin(null)
          setAuthError('Your admin session has expired. Sign in again.')
        } else {
          setAdminReviewsError(error.message)
        }
      })
    return () => { active = false }
  }, [admin, section, refreshKey])

  useEffect(() => {
    if (!admin) return undefined

    let active = true
    getAdminProducts({
      page: productPage,
      limit: 12,
      sort: 'name-asc',
      search: productSearch,
      collection: collectionFilter,
      published: availabilityFilter === '' ? undefined : availabilityFilter,
    })
      .then((response) => {
        if (!active) return
        setProducts(response.data)
        setCatalogTotal(response.pagination.total)
        setCatalogPages(response.pagination.totalPages)
        setProductsLoadedKey(productsRequestKey)
      })
      .catch((error) => {
        if (!active) return
        setProductsLoadedKey(productsRequestKey)
        if (error.status === 401) {
          setAdmin(null)
          setAuthError('Your admin session has expired. Sign in again.')
        } else {
          setCatalogError(error.message)
        }
      })

    return () => {
      active = false
    }
  }, [admin, productsRequestKey, productPage, productSearch, collectionFilter, availabilityFilter, refreshKey])

  async function handleCreatePromotion(event) {
    event.preventDefault()
    setCatalogBusy(true)
    setCatalogError('')
    try {
      const response = await createAdminPromotion({
        ...promotionForm,
        code: promotionForm.code.trim().toUpperCase(),
        discountValue: Number(promotionForm.discountValue),
        minimumSubtotal: Number(promotionForm.minimumSubtotal),
        usageLimit: promotionForm.usageLimit ? Number(promotionForm.usageLimit) : null,
        startsAt: promotionForm.startsAt ? new Date(promotionForm.startsAt).toISOString() : null,
        endsAt: promotionForm.endsAt ? new Date(promotionForm.endsAt).toISOString() : null,
      })
      setPromotions((current) => [response.data, ...current])
      setPromotionForm({ code: '', category: 'coupon', discountType: 'percent', discountValue: '10', minimumSubtotal: '0', usageLimit: '', startsAt: '', endsAt: '' })
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  async function handlePromotionStatus(promotion) {
    setCatalogBusy(true)
    setCatalogError('')
    try {
      const response = await updateAdminPromotionStatus(promotion.code, !promotion.active)
      setPromotions((current) => current.map((item) => item.code === promotion.code ? response.data : item))
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  async function handleDeletePromotion(promotion) {
    if (!window.confirm(`Delete ${promotion.code}? Orders already placed with this code will remain unchanged.`)) return
    setCatalogBusy(true)
    setCatalogError('')
    try {
      await deleteAdminPromotion(promotion.code)
      setPromotions((current) => current.filter((item) => item.code !== promotion.code))
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  async function handleLogout() {
    setAuthError('')
    try {
      await deleteAdminSession()
      setAdmin(null)
      setSelectedOrder(null)
      setOrdersLoadedKey('')
      setOverview(null)
      setActivity([])
      setActivityLoadedKey('')
      setProducts([])
      setCatalogTotal(0)
      setCatalogPages(1)
      setCustomers([])
      setManagedCategories([])
    } catch (error) {
      setAuthError(error.message)
    }
  }

  async function handleSelectOrder(orderNumber) {
    setOrdersError('')
    try {
      const response = await getAdminOrder(orderNumber)
      setSelectedOrder(response.data)
    } catch (error) {
      setOrdersError(error.message)
    }
  }

  async function handleStatusChange(status, targetOrder = selectedOrder) {
    if (!targetOrder) return
    if (status === 'cancelled' && !window.confirm(
      'Cancel this order and return its quantities to inventory?',
    )) return

    setActionInProgress(`${targetOrder.orderNumber}:${status}`)
    setOrdersError('')
    try {
      const response = await updateAdminOrderStatus(targetOrder.orderNumber, status)
      setOrders((current) => current.map((order) => (
        order.orderNumber === targetOrder.orderNumber
          ? { ...order, status: response.data.status }
          : order
      )))
      if (selectedOrder?.orderNumber === targetOrder.orderNumber) setSelectedOrder(response.data)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setOrdersError(error.message)
    } finally {
      setActionInProgress('')
    }
  }

  async function handleItemStatusChange(sku, status) {
    if (!selectedOrder) return
    setActionInProgress(`${sku}:${status}`)
    setOrdersError('')
    try {
      const response = await updateAdminOrderItemStatus(selectedOrder.orderNumber, sku, status)
      setSelectedOrder(response.data)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setOrdersError(error.message)
    } finally {
      setActionInProgress('')
    }
  }

  async function handleCreateProduct(event) {
    event.preventDefault()
    setCatalogBusy(true)
    setCatalogError('')
    try {
      const response = await createAdminProduct({
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        sizes: productForm.sizes.split(',').map((size) => size.trim()).filter(Boolean),
        notes: productForm.notes.split(',').map((note) => note.trim()).filter(Boolean),
      })
      const slug = response.data.slug
      let imageUploadError = ''
      if (newProductFrontImage) {
        try {
          await uploadAdminProductImage(slug, newProductFrontImage, 'front')
        } catch (error) {
          imageUploadError = error.message
        }
      }
      for (const image of newProductGalleryImages) {
        try {
          await uploadAdminProductImage(slug, image, 'gallery')
        } catch (error) {
          imageUploadError = imageUploadError || error.message
        }
      }
      setProductFormOpen(false)
      setNewProductFrontImage(null)
      setNewProductGalleryImages([])
      setProductForm({
        name: '',
        family: '',
        gender: 'unisex',
        category: 'unisex',
        concentration: 'Eau de Parfum',
        price: '',
        sizes: '30 ml, 50 ml',
        stock: '10',
        description: '',
        notes: '',
        collection: 'signature',
      })
      setProductPage(1)
      setProductSearch('')
      setRefreshKey((current) => current + 1)
      if (imageUploadError) setCatalogError(`Product created, but an image could not be uploaded: ${imageUploadError}`)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) return

    setCatalogBusy(true)
    setCatalogError('')
    try {
      const response = await createAdminCategory(name)
      setManagedCategories((current) => (
        [...current, { ...response.data, productCount: 0 }].sort((left, right) => left.name.localeCompare(right.name))
      ))
      setCategoryName('')
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  async function handleDeleteCategory(category) {
    setCatalogError('')
    try {
      await deleteAdminCategory(category.key)
      setManagedCategories((current) => current.filter(({ key }) => key !== category.key))
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setCatalogError(error.message)
    }
  }

  async function handleInventorySave(product, saveFacetEdits = false) {
    const hasInvalidPrice = product.variants.some(({ sku, price }) => {
      const value = priceEdits[sku] ?? price
      return value === '' || !Number.isFinite(Number(value)) || Number(value) < 0
    })
    if (hasInvalidPrice) {
      setCatalogError('Enter a valid non-negative price for every product size.')
      return
    }

    const selectedSizes = saveFacetEdits
      ? sizeEdits[product.slug] ?? product.variants.map(({ size }) => size)
      : product.variants.map(({ size }) => size)
    if (!selectedSizes.length) {
      setCatalogError('Select at least one bottle size.')
      return
    }

    setCatalogBusy(true)
    setCatalogError('')
    try {
      const inventory = {
        available: product.available,
        collection: collectionEdits[product.slug] ?? product.collection ?? product.collectionName,
        category: genderEdits[product.slug] || product.category || product.gender,
        family: familyEdits[product.slug] ?? product.family,
        concentration: concentrationEdits[product.slug] ?? product.concentration,
        sizes: selectedSizes,
        variants: selectedSizes.map((size) => {
          const variant = product.variants.find(
            (candidate) => candidate.size.toLowerCase() === size.toLowerCase(),
          )
          return variant ? {
            sku: variant.sku,
            size: variant.size,
            stock: Number(stockEdits[variant.sku] ?? variant.stock),
            price: Number(priceEdits[variant.sku] ?? variant.price),
          } : {
            size,
            stock: 0,
            price: product.price,
          }
        }),
      }
      const response = await updateAdminProductInventory(product.slug, inventory)
      setProducts((current) => current.map((item) => (
        item.slug === product.slug ? { ...item, ...response.data } : item
      )))
      setCatalogError('')
      setStockEdits((current) => {
        const next = { ...current }
        product.variants.forEach(({ sku }) => delete next[sku])
        return next
      })
      setCollectionEdits((current) => {
        const next = { ...current }
        delete next[product.slug]
        return next
      })
      setGenderEdits((current) => {
        const next = { ...current }
        delete next[product.slug]
        return next
      })
      setFamilyEdits((current) => {
        const next = { ...current }
        delete next[product.slug]
        return next
      })
      setConcentrationEdits((current) => {
        const next = { ...current }
        delete next[product.slug]
        return next
      })
      setSizeEdits((current) => {
        const next = { ...current }
        delete next[product.slug]
        return next
      })
      setPriceEdits((current) => {
        const next = { ...current }
        product.variants.forEach(({ sku }) => delete next[sku])
        return next
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  function addProductSize(slug, rawSize) {
    const size = rawSize.trim()
    if (!size) return
    setSizeEdits((current) => {
      const currentSizes = current[slug]
        ?? products.find((product) => product.slug === slug)?.variants.map(({ size: value }) => value)
        ?? []
      if (currentSizes.some((item) => item.toLowerCase() === size.toLowerCase())) return current
      return { ...current, [slug]: [...currentSizes, size] }
    })
  }

  async function handleVisibilityToggle(product) {
    setCatalogBusy(true)
    setCatalogError('')
    try {
      const response = await updateAdminProductVisibility(product.slug, product.published === false)
      setProducts((current) => current.map((item) => (
        item.slug === product.slug ? { ...item, ...response.data } : item
      )))
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setCatalogBusy(false)
    }
  }

  function handleImageSelect(slug, file, kind = 'front') {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setCatalogError('Choose a JPEG, PNG, or WebP product image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCatalogError('Product images must be 5 MB or smaller.')
      return
    }

    const preview = URL.createObjectURL(file)
    setCatalogError('')
    const key = kind === 'gallery' ? `${slug}:gallery` : slug
    if (kind === 'gallery') setGalleryImageFiles((current) => ({ ...current, [slug]: file }))
    else setImageFiles((current) => ({ ...current, [slug]: file }))
    setImagePreviews((current) => ({ ...current, [key]: preview }))
  }

  async function handleImageUpload(product, kind = 'front') {
    const imageFile = kind === 'gallery' ? galleryImageFiles[product.slug] : imageFiles[product.slug]
    if (!imageFile) return

    setUploadingImageSlug(product.slug)
    setCatalogError('')
    try {
      const response = await uploadAdminProductImage(product.slug, imageFile, kind)
      const imageUrl = response.data.imageUrl
      setProducts((current) => current.map((item) => (
        item.slug === product.slug ? { ...item, imageUrl, galleryImages: response.data.galleryImages ?? item.galleryImages ?? [] } : item
      )))
      const setFiles = kind === 'gallery' ? setGalleryImageFiles : setImageFiles
      setFiles((current) => {
        const next = { ...current }
        delete next[product.slug]
        return next
      })
      setImagePreviews((current) => {
        const next = { ...current }
        delete next[kind === 'gallery' ? `${product.slug}:gallery` : product.slug]
        return next
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setUploadingImageSlug('')
    }
  }

  async function handleGalleryImageRemove(product, imageUrl) {
    setUploadingImageSlug(product.slug)
    setCatalogError('')
    try {
      const response = await deleteAdminProductGalleryImage(product.slug, imageUrl)
      setProducts((current) => current.map((item) => item.slug === product.slug
        ? { ...item, galleryImages: response.data.galleryImages ?? [] }
        : item))
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setUploadingImageSlug('')
    }
  }

  async function handleImageRemove(product) {
    setUploadingImageSlug(product.slug)
    setCatalogError('')
    try {
      await deleteAdminProductImage(product.slug)
      setProducts((current) => current.map((item) => (
        item.slug === product.slug ? { ...item, imageUrl: '' } : item
      )))
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setCatalogError(error.message)
    } finally {
      setUploadingImageSlug('')
    }
  }

  if (!authChecked) {
    return (
      <main className="admin-page section-wrap">
        <p className="api-state" role="status">Checking admin access…</p>
      </main>
    )
  }

  if (!admin) {
    return <Navigate to="/login" replace />
  }

  const navItems = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['orders', 'Orders', ShoppingBag],
    ['products', 'Products', Boxes],
    ['customers', 'Customers', Users],
    ['categories', 'Categories', Boxes],
    ['reviews', 'Reviews', Star],
    ['promotions', 'Rewards & coupons', TicketPercent],
    ['activity', 'Activity Logs', Activity],
    ['settings', 'Settings', Settings],
  ]

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/">
          <span className="admin-brand-mark">✦</span>
          <span>IKIRA <small>STORE OPERATIONS</small></span>
        </Link>
        <nav aria-label="Admin navigation">
          {navItems.map(([id, label, Icon]) => (
            <button
              className={section === id ? 'active' : ''}
              key={id}
              type="button"
              onClick={() => setSection(id)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/"><ShoppingBag size={17} /> View store</Link>
          <button type="button" onClick={handleLogout}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">STORE OPERATIONS</p>
            <h1>{navItems.find(([id]) => id === section)?.[1]}</h1>
          </div>
          <div className="admin-topbar-actions">
            <ThemeToggle variant="admin" />
            <button
              className="admin-secondary-button admin-refresh-button"
              type="button"
              aria-label="Refresh dashboard data"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <Link className="admin-primary-button" to="/shop">
              <ShoppingBag size={15} /> View Store
            </Link>
            <span className="admin-user-badge"><span>{admin.username.slice(0, 1).toUpperCase()}</span>{admin.username}</span>
            <button className="admin-secondary-button" type="button" onClick={() => setSection("settings")}>My account</button>
            <button className="admin-secondary-button" type="button" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="admin-content">
          {authError && <p className="admin-error" role="alert">{authError}</p>}
          {catalogError && section !== 'activity' && <p className="admin-error" role="alert">{catalogError}</p>}

          {section === 'dashboard' && (
            <>
              <div className="admin-metric-grid">
                <article><span>Annual revenue</span><strong>{overview ? formatPrice(overview.annualRevenue) : '—'}</strong><small>Non-cancelled orders this year</small></article>
                <article><span>Total orders</span><strong>{overview?.orderCount ?? '—'}</strong><small>{overview?.pendingOrders ?? 0} pending dispatch</small></article>
                <article><span>Active catalog</span><strong>{overview?.activeProducts ?? '—'}</strong><small>{overview?.categories?.length ?? 0} collections</small></article>
                <article><span>Low stock sizes</span><strong>{overview?.lowStockItems ?? '—'}</strong><small>Three or fewer bottles in stock</small></article>
              </div>
              <div className="admin-dashboard-grid">
                <section className="admin-panel">
                  <div className="admin-panel-title"><div><p className="eyebrow">RECENT STORE ACTIVITY</p><h2>Latest orders</h2></div><button className="admin-text-button" type="button" onClick={() => setSection('activity')}>View activity →</button></div>
                  {overview?.recentOrders?.length ? (
                    <div className="admin-order-table-wrap">
                      <table className="admin-order-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Total</th><th>Status</th></tr></thead>
                        <tbody>{overview.recentOrders.map((order) => <tr key={order.orderNumber}><td><button className="admin-order-link" type="button" onClick={() => { setSection('orders'); handleSelectOrder(order.orderNumber) }}>{order.orderNumber}</button></td><td>{order.customer.fullName}</td><td>{formatDate(order.createdAt)}</td><td>{formatPrice(order.total)}</td><td><span className={`admin-status status-${order.status}`}>{order.status}</span></td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="admin-empty">No orders have been placed yet.</p>}
                </section>
                <section className="admin-panel admin-quick-panel">
                  <p className="eyebrow">ATTENTION</p><h2>Store quick overview</h2>
                  <p>Orders awaiting confirmation or dispatch</p>
                  <button
                    className="admin-pending-count"
                    type="button"
                    aria-label="View pending orders"
                    onClick={() => {
                      setStatusFilter('pending')
                      setPage(1)
                      setSection('orders')
                    }}
                  >
                    {overview?.pendingOrders ?? 0}
                  </button>
                  <button className="admin-text-button" type="button" onClick={() => { setStatusFilter(''); setPage(1); setSection('orders') }}>View all orders →</button>
                  <button className="admin-primary-button" type="button" onClick={() => setSection('products')}><PackagePlus size={16} /> Manage products</button>
                  <div className="admin-review-summary"><Star size={16} /> {Number(overview?.averageRating ?? 0).toFixed(1)} average catalog rating · {overview?.reviewCount ?? 0} ratings</div>
                </section>
              </div>
            </>
          )}

          {section === 'orders' && <>
      <div className="admin-heading">
        <div>
          <h2>Orders, thoughtfully handled.</h2>
          <p>Signed in as {admin.username}. {pagination.total} orders in this view.</p>
        </div>
      </div>

      {ordersError && <p className="admin-error" role="alert">{ordersError}</p>}
      <div className="admin-orders-layout">
        <section className="admin-orders-panel" aria-labelledby="admin-orders-title">
          <div className="admin-panel-heading">
            <h2 id="admin-orders-title">Guest orders</h2>
            <label>
              <span className="visually-hidden">Filter orders by status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value)
                  setPage(1)
                  setSelectedOrder(null)
                  setOrdersError('')
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending dispatch</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <p role="status">Loading orders…</p>
          ) : orders.length ? (
            <>
              <div className="admin-order-table-wrap">
                <table className="admin-order-table">
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Placed</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Total</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.orderNumber}>
                        <td>
                          <button
                            className="admin-order-link"
                            type="button"
                            onClick={() => handleSelectOrder(order.orderNumber)}
                          >
                            {order.orderNumber}
                          </button>
                        </td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>{order.customer.fullName}</td>
                        <td>{formatPrice(order.total)}</td>
                        <td>
                          <label className="admin-order-status-control">
                            <span className="visually-hidden">Change status for {order.orderNumber}</span>
                            <select
                              className={`admin-order-status-select status-${order.status}`}
                              value={order.status}
                              disabled={Boolean(actionInProgress)}
                              onChange={(event) => handleStatusChange(event.target.value, order)}
                            >
                              {[order.status, ...(transitions[order.status] ?? [])]
                                .filter((status, index, statuses) => statuses.indexOf(status) === index)
                                .map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-pagination">
                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setOrdersError('')
                    setPage((current) => current - 1)
                  }}
                >
                  Previous
                </button>
                <span>Page {page} of {Math.max(pagination.pages, 1)}</span>
                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={page >= pagination.pages || loading}
                  onClick={() => {
                    setOrdersError('')
                    setPage((current) => current + 1)
                  }}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <p className="admin-empty">No orders match this status yet.</p>
          )}
        </section>

        <section className="admin-order-detail" aria-labelledby="admin-detail-title">
          {selectedOrder ? (
            <>
              <p className="eyebrow">Order details</p>
              <h2 id="admin-detail-title">{selectedOrder.orderNumber}</h2>
              <span className={`admin-status status-${selectedOrder.status}`}>
                {selectedOrder.status}
              </span>
              <dl className="admin-customer-details">
                <div><dt>Customer</dt><dd>{selectedOrder.customer.fullName}</dd></div>
                <div><dt>Phone</dt><dd><a href={`tel:${selectedOrder.customer.phone}`}>{selectedOrder.customer.phone}</a></dd></div>
                {selectedOrder.customer.email && (
                  <div><dt>Email</dt><dd><a href={`mailto:${selectedOrder.customer.email}`}>{selectedOrder.customer.email}</a></dd></div>
                )}
                <div>
                  <dt>Delivery address</dt>
                  <dd>
                    {selectedOrder.customer.addressLine1}
                    {selectedOrder.customer.addressLine2 && `, ${selectedOrder.customer.addressLine2}`}
                    {`, ${selectedOrder.customer.city}`}
                    {selectedOrder.customer.postalCode && ` ${selectedOrder.customer.postalCode}`}
                  </dd>
                </div>
                <div>
                  <dt>Store email alert</dt>
                  <dd>
                    {selectedOrder.notificationStatus || 'not tracked'}
                    {selectedOrder.notificationAttempts > 0
                      ? ` · ${selectedOrder.notificationAttempts} attempt${selectedOrder.notificationAttempts === 1 ? '' : 's'}`
                      : ''}
                  </dd>
                </div>
              </dl>
              <ul className="admin-order-items">
                {selectedOrder.items.map((item) => (
                  <li key={item.sku}>
                    <div className="admin-order-item-info">
                      <span>{item.productName} / {item.size} × {item.quantity}</span>
                      <strong>{formatPrice(item.lineTotal)}</strong>
                    </div>
                    <label className="admin-order-item-status">
                      <span>Status</span>
                      <select
                        aria-label={`Status for ${item.productName} ${item.size}`}
                        value={item.status ?? selectedOrder.status}
                        disabled={Boolean(actionInProgress) || selectedOrder.status === 'cancelled'}
                        onChange={(event) => handleItemStatusChange(item.sku, event.target.value)}
                      >
                        {[item.status ?? selectedOrder.status, ...(itemStatusTransitions[item.status ?? selectedOrder.status] ?? [])]
                          .filter((status, index, statuses) => statuses.indexOf(status) === index)
                          .map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
              <dl className="admin-order-total">
                <div><dt>Subtotal</dt><dd>{formatPrice(selectedOrder.subtotal)}</dd></div>
                <div><dt>Delivery</dt><dd>{selectedOrder.deliveryFee ? formatPrice(selectedOrder.deliveryFee) : 'Free'}</dd></div>
                <div><dt>Total / COD</dt><dd>{formatPrice(selectedOrder.total)}</dd></div>
              </dl>
              <div className="admin-order-actions">
                {transitions[selectedOrder.status].map((status) => (
                  <button
                    className={status === 'cancelled' ? 'admin-secondary-button danger' : 'hero-cta'}
                    disabled={Boolean(actionInProgress)}
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                  >
                    {actionInProgress === `${selectedOrder.orderNumber}:${status}` ? 'Updating…' : `Mark ${status}`}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="admin-empty-detail">
              <p className="eyebrow">Order desk</p>
              <h2 id="admin-detail-title">Choose an order to review.</h2>
              <p>Customer delivery details and status actions will appear here.</p>
            </div>
          )}
        </section>
      </div>
          </>}

          {section === 'products' && (
            <section className="admin-panel">
              <div className="admin-panel-title">
                <div><p className="eyebrow">CATALOG MANAGEMENT</p><h2>Products & inventory</h2><span className="admin-result-count">{catalogTotal} products · showing first {products.length}</span></div>
                <button className="admin-primary-button" type="button" onClick={() => { setCatalogError(''); setProductFormOpen(true) }}><PackagePlus size={16} /> Add product</button>
              </div>
              <div className="admin-product-filters">
                <label className="admin-search-field">
                  <Search size={16} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Search catalog"
                    placeholder="Search products"
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value)
                      setProductPage(1)
                    }}
                  />
                </label>
                <label>
                  <span className="visually-hidden">Filter by collection</span>
                  <select value={collectionFilter} onChange={(event) => { setCollectionFilter(event.target.value); setProductPage(1) }}>
                    <option value="">All collections</option>
                    {(overview?.categories ?? []).map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  <span className="visually-hidden">Filter by visibility</span>
                  <select value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value); setProductPage(1) }}>
                    <option value="">All visibility</option>
                    <option value="true">Active</option>
                    <option value="false">Hidden</option>
                  </select>
                </label>
              </div>
              <>
                <datalist id="admin-family-options">{(overview?.filterOptions?.families ?? []).map((option) => <option key={option} value={option} />)}</datalist>
                <datalist id="admin-concentration-options">{(overview?.filterOptions?.concentrations ?? []).map((option) => <option key={option} value={option} />)}</datalist>
                <datalist id="admin-collection-options">{(overview?.filterOptions?.collections ?? []).map((option) => <option key={option} value={option} />)}</datalist>
                <datalist id="admin-size-options">{(overview?.filterOptions?.sizes ?? []).map((option) => <option key={option} value={option} />)}</datalist>
                {productFormOpen && createPortal(<div className="admin-product-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !catalogBusy) setProductFormOpen(false) }}>
                  <section className="admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="admin-new-product-title">
                    <header className="admin-product-modal-header">
                      <div><p className="eyebrow">CATALOG MANAGEMENT</p><h2 id="admin-new-product-title">Add a product</h2><p>Add product details and choose its front and gallery images.</p></div>
                      <button className="admin-modal-close" type="button" aria-label="Close add product" disabled={catalogBusy} onClick={() => setProductFormOpen(false)}><X size={19} /></button>
                    </header>
                    <form className="admin-product-form" onSubmit={handleCreateProduct}>
                <label>Product name<input autoFocus required maxLength="60" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
                <label>Fragrance family<input required list="admin-family-options" value={productForm.family} onChange={(event) => setProductForm({ ...productForm, family: event.target.value })} /></label>
                <label>Category<select required value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}>{managedCategories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}</select></label>
                <label>Concentration<input required list="admin-concentration-options" value={productForm.concentration} onChange={(event) => setProductForm({ ...productForm, concentration: event.target.value })} /></label>
                <label>Price (PKR)<input required type="number" min="0" step="1" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
                <label>Sizes, comma-separated<input required list="admin-size-options" value={productForm.sizes} onChange={(event) => setProductForm({ ...productForm, sizes: event.target.value })} /></label>
                <label>Stock per size<input required type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label>
                <label>Collection key<input required list="admin-collection-options" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={productForm.collection} onChange={(event) => setProductForm({ ...productForm, collection: event.target.value })} /></label>
                <label>Notes, comma-separated<input required value={productForm.notes} onChange={(event) => setProductForm({ ...productForm, notes: event.target.value })} /></label>
                <label className="admin-form-wide">Description<textarea required maxLength="2000" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                <div className="admin-new-product-images admin-form-wide">
                  <label>Front image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) setCatalogError('Choose a JPEG, PNG, or WebP image no larger than 5 MB.')
                    else { setCatalogError(''); setNewProductFrontImage(file ?? null) }
                    event.currentTarget.value = ''
                  }} />{newProductFrontImage && <span>{newProductFrontImage.name}</span>}</label>
                  <label>Other images<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const files = [...(event.target.files ?? [])]
                    const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
                    if (invalid) setCatalogError('Choose JPEG, PNG, or WebP images no larger than 5 MB each.')
                    else { setCatalogError(''); setNewProductGalleryImages(files) }
                    event.currentTarget.value = ''
                  }} />{newProductGalleryImages.length > 0 && <span>{newProductGalleryImages.length} image{newProductGalleryImages.length === 1 ? '' : 's'} selected</span>}</label>
                </div>
                {catalogError && <p className="admin-error admin-form-wide" role="alert">{catalogError}</p>}
                <div className="admin-product-form-actions admin-form-wide"><button className="admin-secondary-button" type="button" disabled={catalogBusy} onClick={() => setProductFormOpen(false)}>Cancel</button><button className="admin-primary-button" type="submit" disabled={catalogBusy}>{catalogBusy ? 'Creating…' : 'Create product'}</button></div>
                    </form>
                  </section>
                </div>, document.body)}
              </>
              {productsLoading ? <p role="status">Loading catalog…</p> :               <div className="admin-order-table-wrap"><table className="admin-order-table"><thead><tr><th>Product</th><th>Image</th><th>Family</th><th>Category</th><th>Collection</th><th>Prices / size (PKR)</th><th>Stock / size</th><th>Visibility</th><th>Actions</th></tr></thead>
                <tbody>{products.map((product) => <Fragment key={product.slug}><tr>
                  <td><strong>{product.name}</strong></td>
                  <td>
                    <div className="admin-product-image-editor">
                      <strong>Front image</strong>
                      {imagePreviews[product.slug] || product.imageUrl ? (
                        <img
                          className="admin-product-image-preview"
                          src={imagePreviews[product.slug] || product.imageUrl}
                          alt={`${product.name} preview`}
                        />
                      ) : (
                        <span className="admin-product-image-placeholder" aria-label="No product image">
                          <ImagePlus size={17} aria-hidden="true" />
                        </span>
                      )}
                      <label className="admin-image-picker">
                        <span>{imageFiles[product.slug] ? 'Change front image' : 'Choose front image'}</span>
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          aria-label={`${product.name} image`}
                          type="file"
                          onChange={(event) => { handleImageSelect(product.slug, event.target.files?.[0]); event.currentTarget.value = '' }}
                        />
                      </label>
                      {imageFiles[product.slug] && (
                        <button
                          className="admin-text-button"
                          type="button"
                          disabled={Boolean(uploadingImageSlug)}
                          onClick={() => handleImageUpload(product)}
                        >
                          {uploadingImageSlug === product.slug ? 'Uploading…' : 'Save image'}
                        </button>
                      )}
                      {product.imageUrl && !imageFiles[product.slug] && (
                        <button
                          className="admin-text-button"
                          type="button"
                          disabled={Boolean(uploadingImageSlug)}
                          onClick={() => handleImageRemove(product)}
                        >
                          Remove image
                        </button>
                      )}
                      <div className="admin-product-gallery-list">
                        <strong>Other images</strong>
                        {(product.galleryImages ?? []).map((imageUrl, index) => (
                          <div className="admin-product-gallery-item" key={imageUrl}>
                            <img className="admin-product-image-preview" src={imageUrl} alt={`${product.name} gallery ${index + 1}`} />
                            <button className="admin-text-button" type="button" disabled={Boolean(uploadingImageSlug)} onClick={() => handleGalleryImageRemove(product, imageUrl)}>Remove</button>
                          </div>
                        ))}
                        {imagePreviews[`${product.slug}:gallery`] && <img className="admin-product-image-preview" src={imagePreviews[`${product.slug}:gallery`]} alt={`${product.name} new gallery image preview`} />}
                        <label className="admin-image-picker">
                          <span>{galleryImageFiles[product.slug] ? 'Change selected image' : 'Add other image'}</span>
                          <input accept="image/jpeg,image/png,image/webp" aria-label={`${product.name} other image`} type="file" onChange={(event) => { handleImageSelect(product.slug, event.target.files?.[0], 'gallery'); event.currentTarget.value = '' }} />
                        </label>
                        {galleryImageFiles[product.slug] && <button className="admin-text-button" type="button" disabled={Boolean(uploadingImageSlug)} onClick={() => handleImageUpload(product, 'gallery')}>{uploadingImageSlug === product.slug ? 'Uploading…' : 'Save other image'}</button>}
                      </div>
                    </div>
                  </td>
                  <td>{product.family}</td>
                  <td><select className="admin-category-edit" aria-label={`${product.name} category`} value={genderEdits[product.slug] ?? product.gender} onChange={(event) => setGenderEdits({ ...genderEdits, [product.slug]: event.target.value })}><option value="women">For Her</option><option value="men">For Him</option><option value="unisex">Unisex</option></select></td>
                  <td><input className="admin-collection-edit" list="admin-collection-options" aria-label={`${product.name} collection`} value={collectionEdits[product.slug] ?? product.collection ?? product.collectionName} onChange={(event) => setCollectionEdits({ ...collectionEdits, [product.slug]: event.target.value })} /></td>
                  <td>{product.variants.map((variant) => <label className="admin-price-edit" key={variant.sku}>{variant.size}<input aria-label={`${product.name} ${variant.size} price in PKR`} type="number" min="0" step="1" value={priceEdits[variant.sku] ?? variant.price} onChange={(event) => setPriceEdits({ ...priceEdits, [variant.sku]: event.target.value })} /></label>)}</td>
                  <td>{product.variants.map((variant) => <label className="admin-stock-edit" key={variant.sku}>{variant.size}<input aria-label={`${product.name} ${variant.size} stock`} type="number" min="0" step="1" value={stockEdits[variant.sku] ?? variant.stock} onChange={(event) => setStockEdits({ ...stockEdits, [variant.sku]: event.target.value })} /></label>)}</td>
                  <td>{product.published === false ? 'Hidden' : 'Published'}</td>
                  <td><div className="admin-row-actions"><button className="admin-text-button" type="button" disabled={catalogBusy} onClick={() => handleInventorySave(product)}>Save changes</button><button className="admin-text-button" type="button" disabled={catalogBusy} onClick={() => handleVisibilityToggle(product)}>{product.published === false ? 'Publish' : 'Hide'}</button><button className="admin-text-button" type="button" onClick={() => { setEditingFacetsSlug((current) => current === product.slug ? '' : product.slug); setSizeEdits((current) => ({ ...current, [product.slug]: product.variants.map(({ size }) => size) })) }}>{editingFacetsSlug === product.slug ? 'Close filters' : 'Edit filters'}</button></div></td>
                </tr>
                {editingFacetsSlug === product.slug && <tr className="admin-product-facets-row"><td colSpan="9">
                  <div className="admin-product-facet-editor">
                    <label>Fragrance family<input list={`edit-family-${product.slug}`} value={familyEdits[product.slug] ?? product.family} onChange={(event) => setFamilyEdits({ ...familyEdits, [product.slug]: event.target.value })} /><datalist id={`edit-family-${product.slug}`}>{(overview?.filterOptions?.families ?? []).map((option) => <option key={option} value={option} />)}</datalist></label>
                    <label>Category<select value={genderEdits[product.slug] ?? product.category ?? product.gender} onChange={(event) => setGenderEdits({ ...genderEdits, [product.slug]: event.target.value })}>{managedCategories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}</select></label>
                    <label>Collection key<input list={`edit-collection-${product.slug}`} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={collectionEdits[product.slug] ?? product.collection ?? product.collectionName} onChange={(event) => setCollectionEdits({ ...collectionEdits, [product.slug]: event.target.value })} /><datalist id={`edit-collection-${product.slug}`}>{(overview?.filterOptions?.collections ?? []).map((option) => <option key={option} value={option} />)}</datalist></label>
                    <label>Concentration<input list={`edit-concentration-${product.slug}`} value={concentrationEdits[product.slug] ?? product.concentration} onChange={(event) => setConcentrationEdits({ ...concentrationEdits, [product.slug]: event.target.value })} /><datalist id={`edit-concentration-${product.slug}`}>{(overview?.filterOptions?.concentrations ?? []).map((option) => <option key={option} value={option} />)}</datalist></label>
                    <fieldset className="admin-size-options"><legend>Bottle sizes</legend>{[...new Set([...(overview?.filterOptions?.sizes ?? []), ...product.variants.map(({ size }) => size), ...(sizeEdits[product.slug] ?? [])])].map((size) => <label key={size}><input type="checkbox" checked={(sizeEdits[product.slug] ?? product.variants.map(({ size: value }) => value)).includes(size)} onChange={(event) => setSizeEdits((current) => { const selected = current[product.slug] ?? product.variants.map(({ size: value }) => value); return { ...current, [product.slug]: event.target.checked ? [...selected, size] : selected.filter((value) => value !== size) } })} />{size}</label>)}</fieldset>
                    <label>Add a bottle size<input list={`edit-size-options-${product.slug}`} aria-label={`${product.name} new bottle size`} placeholder="For example, 75 ml" value={newSizeEdits[product.slug] ?? ''} onChange={(event) => setNewSizeEdits({ ...newSizeEdits, [product.slug]: event.target.value })} /></label>
                    <datalist id={`edit-size-options-${product.slug}`}>{(overview?.filterOptions?.sizes ?? []).map((option) => <option key={option} value={option} />)}</datalist>
                    <button className="admin-secondary-button" type="button" onClick={() => { addProductSize(product.slug, newSizeEdits[product.slug] ?? ''); setNewSizeEdits({ ...newSizeEdits, [product.slug]: '' }) }}>Add size</button>
                    <p className="admin-size-note">New sizes start with zero stock and the current base price. A size can only be removed when its stock is zero and it is not part of a placed or confirmed order.</p>
                    <button className="admin-primary-button" type="button" disabled={catalogBusy} onClick={() => handleInventorySave(product, true)}>Save filter fields</button>
                  </div>
                </td></tr>}
                </Fragment>)}</tbody>
              </table></div>}
              {!productsLoading && !products.length && <p className="admin-empty">No catalog products match these filters.</p>}
              <div className="admin-pagination">
                <button className="admin-secondary-button" type="button" disabled={productPage <= 1 || productsLoading} onClick={() => setProductPage((current) => current - 1)}>Previous</button>
                <span>Page {productPage} of {Math.max(catalogPages, 1)}</span>
                <button className="admin-secondary-button" type="button" disabled={productPage >= catalogPages || productsLoading} onClick={() => setProductPage((current) => current + 1)}>Next</button>
              </div>
            </section>
          )}

          {section === 'customers' && <section className="admin-panel"><div className="admin-panel-title"><div><p className="eyebrow">CUSTOMER DIRECTORY</p><h2>Guest order customers</h2></div><span className="admin-result-count">{customers.length} customers</span></div>
            <div className="admin-order-table-wrap"><table className="admin-order-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime spend</th><th>Last order</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.phone}><td>{customer.fullName}</td><td>{customer.email || '—'}</td><td><a href={`tel:${customer.phone}`}>{customer.phone}</a></td><td>{customer.orderCount}</td><td>{formatPrice(customer.totalSpent)}</td><td>{formatDate(customer.lastOrderAt)}</td></tr>)}</tbody></table></div>
            {!customers.length && <p className="admin-empty">Customer entries are created when guest orders are placed.</p>}
          </section>}

          {section === 'categories' && <section className="admin-panel"><p className="eyebrow">CATALOG ORGANIZATION</p><h2>Product categories</h2><form className="admin-category-create" onSubmit={handleCreateCategory}><label htmlFor="new-category-name">New category name</label><input id="new-category-name" maxLength="60" required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="For example, Bridal Collection" /><button className="admin-primary-button" type="submit" disabled={catalogBusy}><CirclePlus size={15} /> Add category</button></form><div className="admin-category-grid">{managedCategories.map((category) => <article key={category.key}><Boxes size={19} /><strong>{category.name}</strong><span>{category.productCount} products{category.builtIn ? ' · built in' : ''}</span><button className="admin-text-button danger" type="button" disabled={catalogBusy} onClick={() => handleDeleteCategory(category)}>Delete category</button></article>)}</div><p className="admin-empty">Deleting a category removes it from the storefront and unassigns its products.</p></section>}

          {section === 'reviews' && <section className="admin-panel admin-reviews-panel"><p className="eyebrow">CUSTOMER FEEDBACK</p><h2>Customer reviews</h2><div className="admin-review-card"><Star size={24} /><strong>{Number(overview?.averageRating ?? 0).toFixed(1)} / 5</strong><span>Across {overview?.reviewCount ?? 0} product ratings</span></div>
            {adminReviewsError && <p className="admin-error" role="alert">{adminReviewsError}</p>}
            {adminReviews.length ? <div className="admin-customer-review-list">{adminReviews.map((review) => <article key={review.id}>
              <header><div><strong>{review.customerName}</strong><span>{review.rating} / 5 · {formatDate(review.createdAt)}</span></div><Link to={`/product/${review.productSlug}`}>{review.productName}</Link></header>
              {review.title && <h3>{review.title}</h3>}<p>{review.comment}</p>
            </article>)}</div> : !adminReviewsError && <p className="admin-empty">No customer reviews yet. New product reviews will appear here.</p>}
          </section>}

          {section === 'promotions' && <section className="admin-panel admin-promotions-panel">
            <div className="admin-panel-title"><div><p className="eyebrow">CUSTOMER OFFERS</p><h2>Rewards & discount coupons</h2><p>Create coupon codes and reward vouchers customers can use at checkout.</p></div><span className="admin-result-count">{promotions.length} codes</span></div>
            <form className="admin-promotion-form" onSubmit={handleCreatePromotion}>
              <label>Code<input required minLength="3" maxLength="32" pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" value={promotionForm.code} onChange={(event) => setPromotionForm({ ...promotionForm, code: event.target.value.toUpperCase() })} placeholder="WELCOME10" /></label>
              <label>Offer type<select value={promotionForm.category} onChange={(event) => setPromotionForm({ ...promotionForm, category: event.target.value })}><option value="coupon">Discount coupon</option><option value="reward">Reward voucher</option></select></label>
              <label>Discount<select value={promotionForm.discountType} onChange={(event) => setPromotionForm({ ...promotionForm, discountType: event.target.value })}><option value="percent">Percentage</option><option value="fixed">Fixed amount (PKR)</option></select></label>
              <label>{promotionForm.discountType === 'percent' ? 'Percent off' : 'Amount off (PKR)'}<input type="number" min="1" max={promotionForm.discountType === 'percent' ? '100' : undefined} step="1" required value={promotionForm.discountValue} onChange={(event) => setPromotionForm({ ...promotionForm, discountValue: event.target.value })} /></label>
              <label>Minimum order (PKR)<input type="number" min="0" step="1" required value={promotionForm.minimumSubtotal} onChange={(event) => setPromotionForm({ ...promotionForm, minimumSubtotal: event.target.value })} /></label>
              <label>Usage limit <span>(optional)</span><input type="number" min="1" step="1" value={promotionForm.usageLimit} onChange={(event) => setPromotionForm({ ...promotionForm, usageLimit: event.target.value })} placeholder="Unlimited" /></label>
              <label>Starts at <span>(optional)</span><input type="datetime-local" value={promotionForm.startsAt} onChange={(event) => setPromotionForm({ ...promotionForm, startsAt: event.target.value })} /></label>
              <label>Ends at <span>(optional)</span><input type="datetime-local" value={promotionForm.endsAt} onChange={(event) => setPromotionForm({ ...promotionForm, endsAt: event.target.value })} /></label>
              <button className="admin-primary-button" type="submit" disabled={catalogBusy}><CirclePlus size={15} /> Create code</button>
            </form>
            <div className="admin-order-table-wrap"><table className="admin-order-table"><thead><tr><th>Code</th><th>Type</th><th>Discount</th><th>Minimum</th><th>Uses</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {promotions.map((promotion) => <tr key={promotion.code}><td><strong>{promotion.code}</strong></td><td>{promotion.category === 'reward' ? 'Reward voucher' : 'Coupon'}</td><td>{promotion.discountType === 'percent' ? `${promotion.discountValue}%` : formatPrice(promotion.discountValue)}</td><td>{formatPrice(promotion.minimumSubtotal)}</td><td>{promotion.usageCount}{promotion.usageLimit ? ` / ${promotion.usageLimit}` : ' / ∞'}</td><td>{promotion.endsAt ? formatDate(promotion.endsAt) : 'No expiry'}</td><td><span className={`admin-status ${promotion.active ? 'status-delivered' : 'status-cancelled'}`}>{promotion.active ? 'active' : 'paused'}</span></td><td><div className="admin-promotion-actions"><button className="admin-text-button" type="button" disabled={catalogBusy} onClick={() => handlePromotionStatus(promotion)}>{promotion.active ? 'Pause' : 'Activate'}</button><button className="admin-text-button danger" type="button" disabled={catalogBusy} onClick={() => handleDeletePromotion(promotion)}>Delete</button></div></td></tr>)}
            </tbody></table></div>
            {!promotions.length && <p className="admin-empty">No reward vouchers or discount coupons yet. Create one above.</p>}
          </section>}

          {section === 'activity' && <section className="admin-panel"><p className="eyebrow">ADMIN ACTIONS</p><h2>Activity log</h2>
            {activityError && <p className="admin-error" role="alert">{activityError}</p>}
            {activityError ? null : activityLoading ? <p role="status">Loading activity…</p> : activity.length ? (
              <div className="admin-activity-list">{activity.map((entry) => <article key={entry._id}><span className="admin-activity-dot"><Activity size={15} /></span><div><strong>{entry.summary}</strong><p>{entry.action.replaceAll('.', ' ')} · {entry.target} · by {entry.actor}</p></div><time>{formatDate(entry.createdAt)}</time></article>)}</div>
            ) : <p className="admin-empty">No admin activity has been recorded yet. Sign-ins, product, inventory, image, category, and order changes will appear here.</p>}
          </section>}

          {section === 'settings' && <section className="admin-panel"><p className="eyebrow">ADMINISTRATION</p><h2>Account & store settings</h2><dl className="admin-settings-list"><div><dt>Signed in as</dt><dd>{admin.username}</dd></div><div><dt>Authentication</dt><dd>Secure, HTTP-only admin session</dd></div><div><dt>Storefront</dt><dd><Link to="/">Open IKIRA storefront ↗</Link></dd></div></dl><p className="admin-empty">Credentials and store configuration are managed securely in the backend environment, not in the browser.</p><button className="admin-secondary-button danger" type="button" onClick={handleLogout}>Sign out of admin</button></section>}
        </div>
      </div>
    </main>
  )
}

export default AdminPage
