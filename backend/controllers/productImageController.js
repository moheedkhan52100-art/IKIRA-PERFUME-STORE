import { fileTypeFromBuffer } from 'file-type'
import mongoose from 'mongoose'
import { Product } from '../models/Product.js'
import { recordAdminActivity } from '../utils/recordAdminActivity.js'
import { adminProductSlugSchema } from '../validators/adminProducts.js'

const supportedImageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export async function detectSupportedProductImage(buffer, declaredMime) {
  const detectedType = await fileTypeFromBuffer(buffer)
  if (!detectedType || !supportedImageTypes.has(detectedType.mime)) return null
  if (detectedType.mime !== declaredMime) return null
  return detectedType
}

function gridBucket() {
  const database = mongoose.connection.db
  if (!database) throw new Error('MongoDB must be connected before managing product images.')
  return new mongoose.mongo.GridFSBucket(database, { bucketName: 'productImages' })
}

function productImagePath(id) {
  return `/api/media/${id}`
}

function invalidSlug(response) {
  return response.status(400).json({
    error: {
      code: 'INVALID_PRODUCT_SLUG',
      message: 'The product address is invalid.',
    },
  })
}

export async function uploadAdminProductImage(request, response, next) {
  const parsedSlug = adminProductSlugSchema.safeParse(request.params.slug)
  if (!parsedSlug.success) return invalidSlug(response)
  if (!request.file) {
    return response.status(400).json({
      error: { code: 'IMAGE_REQUIRED', message: 'Choose a product image to upload.' },
    })
  }
  if (request.body?.kind && !['front', 'gallery'].includes(request.body.kind)) {
    return response.status(400).json({ error: { code: 'INVALID_IMAGE_KIND', message: 'Choose a front or gallery image.' } })
  }

  let uploadedFileId
  let oldImageId
  try {
    const detectedType = await detectSupportedProductImage(
      request.file.buffer,
      request.file.mimetype,
    )
    const extension = detectedType && supportedImageTypes.get(detectedType.mime)
    if (!detectedType || !extension) {
      return response.status(415).json({
        error: {
          code: 'INVALID_IMAGE_CONTENT',
          message: 'The selected file is not a valid JPEG, PNG, or WebP image.',
        },
      })
    }

    const product = await Product.findOne({ slug: parsedSlug.data }).exec()
    if (!product) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'The product could not be found.' },
      })
    }

    const bucket = gridBucket()
    uploadedFileId = new mongoose.Types.ObjectId()
    const isGalleryImage = request.body?.kind === 'gallery'
    oldImageId = !isGalleryImage && product.imageUrl?.startsWith('/api/media/')
      ? product.imageUrl.slice('/api/media/'.length)
      : ''

    await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStreamWithId(
        uploadedFileId,
        `${parsedSlug.data}.${extension}`,
        {
          contentType: detectedType.mime,
          metadata: {
            productSlug: parsedSlug.data,
            originalName: request.file.originalname.slice(0, 160),
          },
        },
      )
      stream.once('error', reject)
      stream.once('finish', resolve)
      stream.end(request.file.buffer)
    })

    const imageUrl = productImagePath(uploadedFileId.toString())
    if (isGalleryImage) product.galleryImages.push(imageUrl)
    else product.imageUrl = imageUrl
    await product.save()

    if (oldImageId && mongoose.isValidObjectId(oldImageId)) {
      try {
        await bucket.delete(new mongoose.Types.ObjectId(oldImageId))
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`Replaced product image ${oldImageId} could not be deleted.`, error)
        }
      }
    }

    await recordAdminActivity(request, {
      action: 'product.image',
      summary: `Updated the product image for ${product.name}.`,
      target: product.name,
    })
    return response.status(200).json({
      data: {
        imageUrl: product.imageUrl,
        galleryImages: product.galleryImages,
        product: product.toObject(),
      },
    })
  } catch (error) {
    if (uploadedFileId) {
      try {
        await gridBucket().delete(uploadedFileId)
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          console.error('The failed product image upload could not be cleaned up.', cleanupError)
        }
      }
    }
    return next(error)
  }
}

export async function deleteAdminProductGalleryImage(request, response, next) {
  const parsedSlug = adminProductSlugSchema.safeParse(request.params.slug)
  if (!parsedSlug.success) return invalidSlug(response)
  if (!mongoose.isValidObjectId(request.params.imageId)) {
    return response.status(404).json({ error: { code: 'IMAGE_NOT_FOUND', message: 'The product image could not be found.' } })
  }

  try {
    const product = await Product.findOne({ slug: parsedSlug.data }).exec()
    if (!product) return response.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'The product could not be found.' } })
    const imageUrl = productImagePath(request.params.imageId)
    if (!product.galleryImages.includes(imageUrl)) {
      return response.status(404).json({ error: { code: 'IMAGE_NOT_FOUND', message: 'The product image could not be found.' } })
    }
    product.galleryImages = product.galleryImages.filter((url) => url !== imageUrl)
    await product.save()
    try {
      await gridBucket().delete(new mongoose.Types.ObjectId(request.params.imageId))
    } catch (error) {
      if (error.code !== 'ENOENT') return next(error)
    }
    await recordAdminActivity(request, { action: 'product.image', summary: `Removed a gallery image for ${product.name}.`, target: product.name })
    return response.status(200).json({ data: product })
  } catch (error) {
    return next(error)
  }
}

export async function deleteAdminProductImage(request, response, next) {
  const parsedSlug = adminProductSlugSchema.safeParse(request.params.slug)
  if (!parsedSlug.success) return invalidSlug(response)

  try {
    const product = await Product.findOne({ slug: parsedSlug.data }).exec()
    if (!product) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'The product could not be found.' },
      })
    }

    const oldImageId = product.imageUrl?.startsWith('/api/media/')
      ? product.imageUrl.slice('/api/media/'.length)
      : ''
    product.imageUrl = ''
    await product.save()

    if (oldImageId && mongoose.isValidObjectId(oldImageId)) {
      try {
        await gridBucket().delete(new mongoose.Types.ObjectId(oldImageId))
      } catch (error) {
        if (error.code !== 'ENOENT') return next(error)
      }
    }

    await recordAdminActivity(request, {
      action: 'product.image',
      summary: `Removed the product image for ${product.name}.`,
      target: product.name,
    })
    return response.status(200).json({ data: product })
  } catch (error) {
    return next(error)
  }
}

export async function getProductImage(request, response, next) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(404).json({
      error: { code: 'IMAGE_NOT_FOUND', message: 'The product image could not be found.' },
    })
  }

  try {
    const bucket = gridBucket()
    const fileId = new mongoose.Types.ObjectId(request.params.id)
    const [file] = await bucket.find({ _id: fileId }).limit(1).toArray()
    if (!file || !supportedImageTypes.has(file.contentType)) {
      return response.status(404).json({
        error: { code: 'IMAGE_NOT_FOUND', message: 'The product image could not be found.' },
      })
    }

    response.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(file.length),
      'Content-Type': file.contentType,
      'X-Content-Type-Options': 'nosniff',
    })
    const stream = bucket.openDownloadStream(fileId)
    stream.once('error', next)
    return stream.pipe(response)
  } catch (error) {
    return next(error)
  }
}
