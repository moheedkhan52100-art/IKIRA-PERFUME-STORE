import { Product } from '../models/Product.js'
import { Category } from '../models/Category.js'
import { availableCategories } from '../utils/productCategories.js'
import { productListQuerySchema, productSlugSchema } from '../validators/productQuery.js'

const sortOptions = {
  featured: { isBestSeller: -1, rating: -1, name: 1 },
  bestselling: { isBestSeller: -1, rating: -1, name: 1 },
  'name-asc': { name: 1, _id: 1 },
  'price-asc': { price: 1, _id: 1 },
  'price-desc': { price: -1, _id: 1 },
  rating: { rating: -1, _id: 1 },
  newest: { newArrival: -1, createdAt: -1, _id: 1 },
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sendValidationError(response, issues) {
  return response.status(400).json({
    error: {
      code: 'INVALID_QUERY',
      message: 'One or more product query parameters are invalid.',
      details: issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    },
  })
}

export async function listProducts(request, response, next, { includeHidden = false } = {}) {
  const query = { ...request.query }
  let published
  if (includeHidden && query.published !== undefined) {
    if (!['true', 'false'].includes(query.published)) {
      return sendValidationError(response, [{ path: ['published'], message: 'Choose true or false.' }])
    }
    published = query.published === 'true'
    delete query.published
  }
  const parsedQuery = productListQuerySchema.safeParse(query)

  if (!parsedQuery.success) {
    return sendValidationError(response, parsedQuery.error.issues)
  }

  const {
    available,
    category,
    collection,
    concentration,
    familyKey,
    gender,
    limit,
    maxPrice,
    minPrice,
    page,
    search,
    size,
    sort,
  } = parsedQuery.data

  const filter = {}
  if (!includeHidden) filter.published = { $ne: false }
  if (published !== undefined) filter.published = published
  if (available !== undefined) filter.available = available
  if (collection) filter.collectionName = collection.toLowerCase()
  if (concentration) filter.concentration = concentration
  if (familyKey) filter.familyKey = familyKey.toLowerCase()
  if (category) {
    filter.$or = [
      { category },
      { category: { $exists: false }, gender: category },
      { category: '', gender: category },
    ]
  } else if (gender) filter.gender = gender
  if (size) filter.sizes = size

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {}
    if (minPrice !== undefined) filter.price.$gte = minPrice
    if (maxPrice !== undefined) filter.price.$lte = maxPrice
  }

  if (search) {
    const safeSearch = new RegExp(escapeRegularExpression(search), 'i')
    const searchFilter = [
      { name: safeSearch },
      { family: safeSearch },
      { concentration: safeSearch },
      { description: safeSearch },
      { notes: safeSearch },
    ]
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchFilter }]
      delete filter.$or
    } else {
      filter.$or = searchFilter
    }
  }

  try {
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOptions[sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Product.countDocuments(filter).exec(),
    ])

    return response.status(200).json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getProductFilterOptions(_request, response, next) {
  try {
    const [collections, families, concentrations, sizes, customCategories] = await Promise.all([
      Product.distinct('collectionName', { available: true, published: { $ne: false } }).exec(),
      Product.distinct('family', { available: true, published: { $ne: false } }).exec(),
      Product.distinct('concentration', { available: true, published: { $ne: false } }).exec(),
      Product.distinct('variants.size', { available: true, published: { $ne: false } }).exec(),
      Category.find().sort({ name: 1 }).lean().exec(),
    ])
    return response.status(200).json({
      data: {
        collections: collections.sort((left, right) => left.localeCompare(right)),
        families: families.sort((left, right) => left.localeCompare(right)),
        concentrations: concentrations.sort((left, right) => left.localeCompare(right)),
        sizes: sizes.sort((left, right) => left.localeCompare(right)),
        categories: availableCategories(customCategories),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getProductBySlug(request, response, next) {
  const parsedSlug = productSlugSchema.safeParse(request.params.slug)

  if (!parsedSlug.success) {
    return response.status(400).json({
      error: {
        code: 'INVALID_PRODUCT_SLUG',
        message: 'The product slug is invalid.',
      },
    })
  }

  try {
    const product = await Product.findOne({ slug: parsedSlug.data, published: { $ne: false } }).exec()

    if (!product) {
      return response.status(404).json({
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'The requested product was not found.',
        },
      })
    }

    return response.status(200).json({ data: product })
  } catch (error) {
    return next(error)
  }
}
