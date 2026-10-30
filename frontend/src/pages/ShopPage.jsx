import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '../components/products/ProductCard.jsx'
import { getProductFilterOptions, getProducts } from '../services/products.js'
import headingVideo from '../../../images/background/1.mp4'

const MAX_PRICE = 35000
const PAGE_SIZE = 4
const sortOptions = {
  featured: 'featured',
  newest: 'newest',
  'price-low': 'price-asc',
  'price-high': 'price-desc',
  bestselling: 'bestselling',
  rated: 'rating',
}

function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [requestState, setRequestState] = useState({
    key: '',
    status: 'loading',
    error: '',
  })
  const [retryCount, setRetryCount] = useState(0)
  const [filterOptions, setFilterOptions] = useState(null)
  const filterKey = searchParams.toString()
  const requestKey = `${filterKey}|${page}|${retryCount}`
  const loading =
    requestState.key !== requestKey || requestState.status === 'loading'
  const error =
    requestState.key === requestKey && requestState.status === 'error'
      ? requestState.error
      : ''
  const searchTerm = (searchParams.get('search') ?? '').trim()
  const category = searchParams.get('category') ?? searchParams.get('gender') ?? 'all'
  const family = searchParams.get('family') ?? 'all'
  const size = searchParams.get('size') ?? 'all'
  const concentration = searchParams.get('concentration') ?? 'all'
  const availability = searchParams.get('availability') ?? 'all'
  const collection = searchParams.get('collection') ?? 'all'
  const maxPrice = Number(searchParams.get('maxPrice')) || MAX_PRICE
  const sort = searchParams.get('sort') ?? 'featured'

  useEffect(() => {
    const controller = new AbortController()
    getProductFilterOptions({ signal: controller.signal })
      .then((response) => setFilterOptions(response.data))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          console.error('Product filter options could not be loaded.', requestError)
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const filters = new URLSearchParams(filterKey)
    const requestedSort = filters.get('sort') ?? 'featured'
    const requestedPrice = Number(filters.get('maxPrice'))
    const requestedAvailability = filters.get('availability')

    getProducts(
      {
        page,
        limit: PAGE_SIZE,
        search: filters.get('search')?.trim() || undefined,
        category: filters.get('category') || filters.get('gender') || undefined,
        familyKey: filters.get('family') || undefined,
        size: filters.get('size') || undefined,
        concentration: filters.get('concentration') || undefined,
        available:
          requestedAvailability === 'all' || !requestedAvailability
            ? undefined
            : requestedAvailability === 'available',
        collection: filters.get('collection') || undefined,
        maxPrice:
          requestedPrice > 0 && requestedPrice < MAX_PRICE
            ? requestedPrice
            : undefined,
        sort: sortOptions[requestedSort] ?? sortOptions.featured,
      },
      { signal: controller.signal },
    )
      .then((result) => {
        setProducts(result.data)
        setPagination(result.pagination)
        setRequestState({ key: requestKey, status: 'loaded', error: '' })
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setRequestState({
            key: requestKey,
            status: 'error',
            error: requestError.message || 'The fragrance collection could not be loaded.',
          })
        }
      })

    return () => controller.abort()
  }, [filterKey, page, requestKey, retryCount])

  function updateFilter(key, value) {
    const updatedParams = new URLSearchParams(searchParams)
    if (value === 'all' || value === '' || value === String(MAX_PRICE)) {
      updatedParams.delete(key)
    } else {
      updatedParams.set(key, value)
    }
    setSearchParams(updatedParams)
    setPage(1)
  }

  function clearFilters() {
    setSearchParams({})
    setPage(1)
  }

  const pageCount = Math.max(1, pagination.totalPages)
  const currentPage = Math.min(page, pageCount)

  return (
    <main className="shop-page section-wrap">
      <section className="shop-intro">
        <video
          className="shop-intro-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src={headingVideo} type="video/mp4" />
        </video>
        <div className="shop-breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Shop</span>
        </div>
        <header className="shop-heading">
          <p className="eyebrow">Compositions to keep close</p>
          <h1>THE FRAGRANCE COLLECTION</h1>
          <p>
            Thoughtfully composed scents, made to become part of your own story.
            Find the notes that feel like you.
          </p>
        </header>
      </section>

      <div className="shop-toolbar">
        <button
          className="filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="shop-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? <X size={17} /> : <SlidersHorizontal size={17} />}
          {filtersOpen ? 'Close filters' : 'Filters'}
        </button>
        <p className="result-count">
          {loading
            ? 'Loading fragrances…'
            : `${pagination.total} ${pagination.total === 1 ? 'fragrance' : 'fragrances'}`}
        </p>
        <label className="sort-control">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => updateFilter('sort', event.target.value)}>
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="bestselling">Best Selling</option>
            <option value="rated">Highest Rated</option>
          </select>
        </label>
      </div>

      <div className="shop-layout">
        <aside
          className={`shop-filters${filtersOpen ? ' filters-open' : ''}`}
          id="shop-filters"
          aria-label="Product filters"
        >
          <div className="filter-heading">
            <h2>Refine your search</h2>
            <button type="button" onClick={clearFilters}>
              Clear all
            </button>
          </div>

          <form
            className="shop-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              updateFilter('search', String(formData.get('search') ?? '').trim())
            }}
          >
            <label htmlFor="shop-search">Search fragrances</label>
            <div className="shop-search-field">
              <input
                id="shop-search"
                name="search"
                type="search"
                key={searchTerm}
                defaultValue={searchParams.get('search') ?? ''}
                placeholder="Name, note, or family"
              />
              <button type="submit">Search</button>
            </div>
          </form>

          <label className="filter-field">
            <span>Collection</span>
            <select
              value={collection}
              onChange={(event) => updateFilter('collection', event.target.value)}
            >
              <option value="all">All collections</option>
                {(filterOptions?.collections ?? ['signature', 'discovery']).map((option) => (
                  <option key={option} value={option}>{option.split('-').map((word) => (
                    word.charAt(0).toUpperCase() + word.slice(1)
                  )).join(' ')}</option>
                ))}
            </select>
          </label>

          <label className="filter-field">
            <span>For</span>
            <select value={category} onChange={(event) => updateFilter('category', event.target.value)}>
              <option value="all">Everyone</option>
              {(filterOptions?.categories ?? [
                { key: 'men', name: 'For Him' },
                { key: 'women', name: 'For Her' },
                { key: 'unisex', name: 'Unisex' },
              ]).map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
            </select>
          </label>

          <label className="filter-field">
            <span>Fragrance family</span>
            <select value={family} onChange={(event) => updateFilter('family', event.target.value)}>
              <option value="all">All families</option>
              {(filterOptions?.families ?? ['Woody', 'Floral', 'Floral & Woody', 'Amber', 'Spicy & Woody', 'Discovery']).map((option) => {
                const key = option.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                return <option key={key} value={key}>{option}</option>
              })}
            </select>
          </label>

          <label className="filter-field">
            <span>Bottle size</span>
            <select value={size} onChange={(event) => updateFilter('size', event.target.value)}>
              <option value="all">All sizes</option>
              {(filterOptions?.sizes ?? ['30 ml', '50 ml', '100 ml', '5 × 2 ml']).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Concentration</span>
            <select
              value={concentration}
              onChange={(event) => updateFilter('concentration', event.target.value)}
            >
              <option value="all">Any concentration</option>
              {(filterOptions?.concentrations ?? ['Eau de Parfum', 'Eau de Toilette', 'Parfum', 'Discovery Set']).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Availability</span>
            <select
              value={availability}
              onChange={(event) => updateFilter('availability', event.target.value)}
            >
              <option value="all">All products</option>
              <option value="available">In stock</option>
              <option value="unavailable">Sold out</option>
            </select>
          </label>

          <label className="price-filter">
            <span>Maximum price</span>
            <strong>Rs. {new Intl.NumberFormat('en-PK').format(maxPrice)}</strong>
            <input
              type="range"
              min="9500"
              max={MAX_PRICE}
              step="500"
              value={maxPrice}
              aria-label="Maximum price in Pakistani rupees"
              onChange={(event) => updateFilter('maxPrice', event.target.value)}
            />
            <span className="price-range-labels">
              <span>Rs. 9,500</span>
              <span>Rs. 35,000</span>
            </span>
          </label>
        </aside>

        <div className="shop-results">
          {error ? (
            <div className="api-state" role="alert">
              <p className="eyebrow">Collection unavailable</p>
              <h2>We couldn’t load the fragrances.</h2>
              <p>{error}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                Try again
              </button>
            </div>
          ) : loading && products.length === 0 ? (
            <p className="api-state" role="status">Loading the fragrance collection…</p>
          ) : products.length > 0 ? (
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="empty-results" role="status">
              <p className="eyebrow">No notes found</p>
              <h2>Nothing matches just yet.</h2>
              <p>Try a different search or clear a filter to explore the collection.</p>
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}

          {!error && pageCount > 1 && (
            <nav className="shop-pagination" aria-label="Product pages">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span aria-live="polite">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </div>
    </main>
  )
}

export default ShopPage
