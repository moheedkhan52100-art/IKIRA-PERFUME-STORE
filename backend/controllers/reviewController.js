import { z } from 'zod'
import { Product } from '../models/Product.js'
import { Review } from '../models/Review.js'

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional().default(''),
  comment: z.string().trim().min(10).max(2000),
}).strict()

function serializeReview(review) {
  return {
    id: String(review._id),
    customerName: review.customerName,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    createdAt: review.createdAt,
  }
}

async function getReviewSummary(productSlug) {
  const [summary] = await Review.aggregate([
    { $match: { productSlug } },
    { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])
  return {
    rating: summary ? Math.round(summary.rating * 10) / 10 : 0,
    count: summary?.count ?? 0,
  }
}

export async function listProductReviews(request, response, next) {
  try {
    const product = await Product.findOne({ slug: request.params.slug }).select('_id').lean()
    if (!product) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'This fragrance could not be found.' },
      })
    }

    const [reviews, summary] = await Promise.all([
      Review.find({ productSlug: request.params.slug })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec(),
      getReviewSummary(request.params.slug),
    ])
    return response.status(200).json({
      data: reviews.map(serializeReview),
      summary,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listAdminReviews(_request, response, next) {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(200).lean().exec()
    const products = await Product.find({ slug: { $in: [...new Set(reviews.map(({ productSlug }) => productSlug))] } })
      .select('slug name')
      .lean()
      .exec()
    const productNames = new Map(products.map(({ slug, name }) => [slug, name]))
    return response.status(200).json({
      data: reviews.map((review) => ({
        ...serializeReview(review),
        productSlug: review.productSlug,
        productName: productNames.get(review.productSlug) ?? review.productSlug,
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function createProductReview(request, response, next) {
  const parsed = reviewSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'INVALID_REVIEW',
        message: 'Choose a rating and enter a review of at least 10 characters.',
      },
    })
  }

  try {
    const product = await Product.findOne({ slug: request.params.slug }).select('_id').lean()
    if (!product) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'This fragrance could not be found.' },
      })
    }

    const review = await Review.create({
      productSlug: request.params.slug,
      customerId: request.customer._id,
      customerName: request.customer.fullName,
      ...parsed.data,
    })
    const summary = await getReviewSummary(request.params.slug)
    await Product.updateOne(
      { slug: request.params.slug },
      { $set: { rating: summary.rating, reviewCount: summary.count } },
    ).exec()

    return response.status(201).json({ data: { review: serializeReview(review), summary } })
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        error: { code: 'REVIEW_ALREADY_SUBMITTED', message: 'You have already reviewed this fragrance.' },
      })
    }
    return next(error)
  }
}
