import { Product } from '../models/Product.js'
import { Order } from '../models/Order.js'
import { AdminActivity } from '../models/AdminActivity.js'
import { Category } from '../models/Category.js'
import { recordAdminActivity } from '../utils/recordAdminActivity.js'
import {
  availableCategories,
  builtInCategories,
  categoryKey,
  genderForCategory,
} from '../utils/productCategories.js'
import { adminCategoryKeySchema, adminCategorySchema } from '../validators/adminCategories.js'
import {
  adminProductCreateSchema,
  adminProductInventorySchema,
  adminProductSlugSchema,
  adminProductVisibilitySchema,
} from '../validators/adminProducts.js'

function invalidRequest(response, code, message, issues) {
  return response.status(400).json({
    error: {
      code,
      message,
      ...(issues ? {
        details: issues.map(({ path, message: issueMessage }) => ({
          field: path.join('.'),
          message: issueMessage,
        })),
      } : {}),
    },
  })
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function skuFor(slug, size, index) {
  const sizeKey = size.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return `${slug}-${sizeKey || 'SIZE'}-${index + 1}`.toUpperCase()
}

export async function getAdminOverview(_request, response, next) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1)

  try {
    const [
      orderCount,
      pendingOrders,
      annualRevenue,
      activeProducts,
      lowStockItems,
      collectionCounts,
      recentOrders,
      reviewSummary,
      families,
      concentrations,
      sizes,
      categories,
    ] = await Promise.all([
      Order.countDocuments().exec(),
      Order.countDocuments({ status: { $in: ['placed', 'confirmed'] } }).exec(),
      Order.aggregate([
        { $match: { createdAt: { $gte: yearStart }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]).exec(),
      Product.countDocuments({ available: true, published: { $ne: false } }).exec(),
      Product.aggregate([
        { $unwind: '$variants' },
        { $match: { 'variants.stock': { $lte: 3 } } },
        { $count: 'total' },
      ]).exec(),
      Product.aggregate([
        { $group: { _id: '$collectionName', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).exec(),
      Order.find().sort({ createdAt: -1 }).limit(6).lean().exec(),
      Product.aggregate([
        { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: '$reviewCount' } } },
      ]).exec(),
      Product.distinct('family').exec(),
      Product.distinct('concentration').exec(),
      Product.distinct('variants.size').exec(),
      Category.find().sort({ name: 1 }).lean().exec(),
    ])

    return response.status(200).json({
      data: {
        orderCount,
        pendingOrders,
        annualRevenue: annualRevenue[0]?.total ?? 0,
        activeProducts,
        lowStockItems: lowStockItems[0]?.total ?? 0,
        categories: collectionCounts.map(({ _id }) => _id),
        filterOptions: {
          collections: collectionCounts.map(({ _id }) => _id),
          families: families.sort((left, right) => left.localeCompare(right)),
          concentrations: concentrations.sort((left, right) => left.localeCompare(right)),
          sizes: sizes.sort((left, right) => left.localeCompare(right)),
          categories: availableCategories(categories),
        },
        collectionCounts: Object.fromEntries(
          collectionCounts.map(({ _id, count }) => [_id, count]),
        ),
        recentOrders,
        averageRating: reviewSummary[0]?.averageRating ?? 0,
        reviewCount: reviewSummary[0]?.reviewCount ?? 0,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminCategories(_request, response, next) {
  try {
    const customCategories = await Category.find().sort({ name: 1 }).lean().exec()
    const categories = await Promise.all(
      availableCategories(customCategories)
        .map(async (category) => ({
          ...category,
          productCount: await Product.countDocuments(
            category.builtIn
              ? { $or: [{ category: category.key }, { category: { $exists: false }, gender: category.key }] }
              : { category: category.key },
          ).exec(),
        })),
    )
    return response.status(200).json({ data: categories })
  } catch (error) {
    return next(error)
  }
}

export async function createAdminCategory(request, response, next) {
  const parsed = adminCategorySchema.safeParse(request.body)
  if (!parsed.success) {
    return invalidRequest(response, 'INVALID_CATEGORY', 'Enter a category name up to 60 characters.', parsed.error.issues)
  }
  const key = categoryKey(parsed.data.name)
  if (!key) {
    return invalidRequest(response, 'INVALID_CATEGORY', 'Category names must contain letters or numbers.')
  }
  try {
    if (builtInCategories.some((category) => category.key === key)) {
      const category = await Category.findOne({ key, builtIn: true }).exec()
      if (!category || category.active !== false) {
        return response.status(409).json({
          error: { code: 'CATEGORY_ALREADY_EXISTS', message: 'That built-in category already exists.' },
        })
      }
      category.active = true
      await category.save()
      await recordAdminActivity(request, {
        action: 'category.created',
        summary: `Restored category ${category.name}.`,
        target: category.name,
      })
      return response.status(201).json({
        data: { key: category.key, name: category.name, builtIn: true },
      })
    }
    if (await Category.exists({ key })) {
      return response.status(409).json({
        error: { code: 'CATEGORY_ALREADY_EXISTS', message: 'That category already exists.' },
      })
    }
    const category = await Category.create({ key, name: parsed.data.name })
    await recordAdminActivity(request, {
      action: 'category.created',
      summary: `Created category ${category.name}.`,
      target: category.name,
    })
    return response.status(201).json({ data: { key: category.key, name: category.name, builtIn: false } })
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        error: { code: 'CATEGORY_ALREADY_EXISTS', message: 'That category already exists.' },
      })
    }
    return next(error)
  }
}

export async function deleteAdminCategory(request, response, next) {
  const parsedKey = adminCategoryKeySchema.safeParse(request.params.key)
  if (!parsedKey.success) {
    return invalidRequest(response, 'INVALID_CATEGORY_KEY', 'The category address is invalid.')
  }
  try {
    const builtInCategory = builtInCategories.find(({ key }) => key === parsedKey.data)
    const category = await Category.findOne({ key: parsedKey.data }).exec()
    if (!builtInCategory && !category) {
      return response.status(404).json({
        error: { code: 'CATEGORY_NOT_FOUND', message: 'The category could not be found.' },
      })
    }
    await Product.updateMany({
      $or: [
        { category: parsedKey.data },
        { category: { $exists: false }, gender: parsedKey.data },
        { category: '', gender: parsedKey.data },
      ],
    }, {
      $set: { category: null, gender: 'unisex' },
    }).exec()
    if (builtInCategory) {
      if (category) {
        category.name = builtInCategory.name
        category.builtIn = true
        category.active = false
        await category.save()
      } else {
        await Category.create({
          key: builtInCategory.key,
          name: builtInCategory.name,
          builtIn: true,
          active: false,
        })
      }
    } else {
      await category.deleteOne()
    }
    await recordAdminActivity(request, {
      action: 'category.deleted',
      summary: `Deleted category ${builtInCategory?.name ?? category.name}.`,
      target: builtInCategory?.name ?? category.name,
    })
    return response.status(200).json({ data: { key: parsedKey.data } })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminActivity(_request, response, next) {
  try {
    const activity = await AdminActivity.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec()
    return response.status(200).json({ data: activity })
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminProductVisibility(request, response, next) {
  const parsedSlug = adminProductSlugSchema.safeParse(request.params.slug)
  if (!parsedSlug.success) {
    return invalidRequest(response, 'INVALID_PRODUCT_SLUG', 'The product address is invalid.')
  }

  const parsedVisibility = adminProductVisibilitySchema.safeParse(request.body)
  if (!parsedVisibility.success) {
    return invalidRequest(
      response,
      'INVALID_PRODUCT_VISIBILITY',
      'Choose whether this product should be published in the storefront.',
      parsedVisibility.error.issues,
    )
  }

  try {
    const product = await Product.findOneAndUpdate(
      { slug: parsedSlug.data },
      { $set: { published: parsedVisibility.data.published } },
      { new: true, runValidators: true },
    ).exec()
    if (!product) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'The product could not be found.' },
      })
    }
    await recordAdminActivity(request, {
      action: 'product.visibility',
      summary: `${product.name} was ${product.published ? 'published' : 'hidden'} in the store.`,
      target: product.name,
    })
    return response.status(200).json({ data: product })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminCustomers(_request, response, next) {
  try {
    const customers = await Order.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$customer.phone',
          fullName: { $first: '$customer.fullName' },
          phone: { $first: '$customer.phone' },
          email: { $first: '$customer.email' },
          orderCount: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$total'],
            },
          },
          lastOrderAt: { $first: '$createdAt' },
        },
      },
      { $sort: { lastOrderAt: -1 } },
      { $limit: 500 },
      { $project: { _id: 0, fullName: 1, phone: 1, email: 1, orderCount: 1, totalSpent: 1, lastOrderAt: 1 } },
    ]).exec()
    return response.status(200).json({ data: customers })
  } catch (error) {
    return next(error)
  }
}

export async function createAdminProduct(request, response, next) {
  const parsed = adminProductCreateSchema.safeParse(request.body)
  if (!parsed.success) {
    return invalidRequest(
      response,
      'INVALID_PRODUCT',
      'Check the product details and try again.',
      parsed.error.issues,
    )
  }

  const details = parsed.data
  const slug = slugify(details.name)
  const familyKey = slugify(details.family)
  if (!slug || !familyKey) {
    return invalidRequest(response, 'INVALID_PRODUCT_NAME', 'The product name must contain letters or numbers.')
  }

  try {
    const selectedCategory = details.category
      ? availableCategories(await Category.find().lean().exec())
        .find(({ key }) => key === details.category)
      : null
    if (details.category && !selectedCategory) {
      return invalidRequest(response, 'CATEGORY_NOT_FOUND', 'Choose a category managed in the admin panel.')
    }
    if (await Product.exists({ slug })) {
      return response.status(409).json({
        error: { code: 'PRODUCT_ALREADY_EXISTS', message: 'A product with this name already exists.' },
      })
    }

    const product = await Product.create({
      slug,
      name: details.name,
      family: details.family,
      familyKey,
      gender: selectedCategory ? genderForCategory(selectedCategory.key) : details.gender,
      category: selectedCategory?.key ?? details.gender,
      concentration: details.concentration,
      price: details.price,
      sizes: details.sizes,
      rating: 0,
      reviewCount: 0,
      available: true,
      newArrival: true,
      isBestSeller: false,
      collectionName: details.collection,
      accent: 'peach',
      description: details.description,
      notes: details.notes,
      variants: details.sizes.map((size, index) => ({
        size,
        sku: skuFor(slug, size, index),
        price: details.price,
        stock: details.stock,
      })),
    })

    await recordAdminActivity(request, {
      action: 'product.created',
      summary: `Created ${product.name} for ${product.gender}.`,
      target: product.name,
    })
    return response.status(201).json({ data: product })
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        error: { code: 'PRODUCT_ALREADY_EXISTS', message: 'A product with this name already exists.' },
      })
    }
    return next(error)
  }
}

export async function updateAdminProductInventory(request, response, next) {
  const parsedSlug = adminProductSlugSchema.safeParse(request.params.slug)
  if (!parsedSlug.success) {
    return invalidRequest(response, 'INVALID_PRODUCT_SLUG', 'The product address is invalid.')
  }

  const parsedInventory = adminProductInventorySchema.safeParse(request.body)
  if (!parsedInventory.success) {
    return invalidRequest(
      response,
      'INVALID_PRODUCT_INVENTORY',
      'Check the product inventory and try again.',
      parsedInventory.error.issues,
    )
  }

  try {
    const product = await Product.findOne({ slug: parsedSlug.data }).exec()
    if (!product) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'The product could not be found.' },
      })
    }

    if (parsedInventory.data.category) {
      const category = availableCategories(await Category.find().lean().exec())
        .find(({ key }) => key === parsedInventory.data.category)
      if (!category) {
        return invalidRequest(response, 'CATEGORY_NOT_FOUND', 'Choose a category managed in the admin panel.')
      }
      product.category = category.key
      product.gender = genderForCategory(category.key)
    } else if (parsedInventory.data.gender) {
      product.gender = parsedInventory.data.gender
      product.category = parsedInventory.data.gender
    }

    const requestedSizes = parsedInventory.data.sizes
      ?? product.variants.map(({ size }) => size)
    const requestedSizeKeys = requestedSizes.map((size) => size.toLowerCase())
    if (new Set(requestedSizeKeys).size !== requestedSizeKeys.length) {
      return invalidRequest(
        response,
        'INVALID_PRODUCT_VARIANTS',
        'Product sizes must be unique.',
      )
    }

    const updatesBySize = new Map()
    for (const update of parsedInventory.data.variants) {
      const existing = update.sku
        ? product.variants.find(({ sku }) => sku === update.sku)
        : product.variants.find(({ size }) => size.toLowerCase() === update.size.toLowerCase())
      if (update.sku && !existing) {
        return invalidRequest(response, 'INVALID_PRODUCT_VARIANTS', 'An updated product SKU is invalid.')
      }
      if (update.sku && update.size && existing.size.toLowerCase() !== update.size.toLowerCase()) {
        return invalidRequest(response, 'INVALID_PRODUCT_VARIANTS', 'A product size cannot be changed without a new SKU.')
      }
      const size = update.size ?? existing?.size
      if (!size || updatesBySize.has(size.toLowerCase())) {
        return invalidRequest(response, 'INVALID_PRODUCT_VARIANTS', 'Product variants must have unique sizes.')
      }
      updatesBySize.set(size.toLowerCase(), { ...update, size, existing })
    }
    if (
      updatesBySize.size !== requestedSizes.length ||
      requestedSizeKeys.some((key) => !updatesBySize.has(key))
    ) {
      return invalidRequest(
        response,
        'INVALID_PRODUCT_VARIANTS',
        'Provide pricing and stock for every selected bottle size.',
      )
    }

    const removedVariants = product.variants.filter(
      ({ size }) => !requestedSizeKeys.includes(size.toLowerCase()),
    )
    if (removedVariants.some(({ stock }) => stock > 0)) {
      return response.status(409).json({
        error: {
          code: 'SIZE_HAS_STOCK',
          message: 'Set a removed size’s stock to zero before removing it.',
        },
      })
    }
    if (removedVariants.length) {
      const hasOpenOrder = await Order.exists({
        status: { $in: ['placed', 'confirmed'] },
        'items.sku': { $in: removedVariants.map(({ sku }) => sku) },
      }).exec()
      if (hasOpenOrder) {
        return response.status(409).json({
          error: {
            code: 'SIZE_IN_OPEN_ORDER',
            message: 'A size in a placed or confirmed order cannot be removed.',
          },
        })
      }
    }

    const usedSkus = new Set(product.variants.map(({ sku }) => sku))
    const nextVariants = requestedSizes.map((size, index) => {
      const update = updatesBySize.get(size.toLowerCase())
      let sku = update.existing?.sku
      if (!sku) {
        let suffix = product.variants.length + index
        do {
          sku = skuFor(product.slug, size, suffix)
          suffix += 1
        } while (usedSkus.has(sku))
        usedSkus.add(sku)
      }
      return {
        size,
        sku,
        stock: update.stock,
        price: update.price ?? parsedInventory.data.price ?? update.existing?.price ?? product.price,
      }
    })
    product.variants = nextVariants
    product.sizes = requestedSizes
    product.available = parsedInventory.data.available
    product.price = Math.min(...product.variants.map(({ price }) => price))
    if (parsedInventory.data.family) {
      if (!slugify(parsedInventory.data.family)) {
        return invalidRequest(response, 'INVALID_PRODUCT_FAMILY', 'The fragrance family must contain letters or numbers.')
      }
      product.family = parsedInventory.data.family
      product.familyKey = slugify(parsedInventory.data.family)
    }
    if (parsedInventory.data.concentration) {
      product.concentration = parsedInventory.data.concentration
    }
    if (parsedInventory.data.collection) {
      product.collectionName = parsedInventory.data.collection
    }
    await product.save()
    await recordAdminActivity(request, {
      action: 'product.updated',
      summary: `Updated pricing, stock, or catalog details for ${product.name}.`,
      target: product.name,
    })
    return response.status(200).json({ data: product })
  } catch (error) {
    return next(error)
  }
}
