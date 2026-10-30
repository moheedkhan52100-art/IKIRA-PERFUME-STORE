import multer from 'multer'

const maximumImageSize = 5 * 1024 * 1024
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maximumImageSize,
    files: 1,
    fields: 1,
    parts: 2,
  },
  fileFilter(_request, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      const error = new Error('Choose a JPEG, PNG, or WebP product image.')
      error.statusCode = 415
      error.code = 'UNSUPPORTED_IMAGE_TYPE'
      callback(error)
      return
    }
    callback(null, true)
  },
})

export function uploadProductImage(request, response, next) {
  upload.single('image')(request, response, (error) => {
    if (!error) {
      next()
      return
    }

    if (error instanceof multer.MulterError) {
      const isLarge = error.code === 'LIMIT_FILE_SIZE'
      response.status(isLarge ? 413 : 400).json({
        error: {
          code: isLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE_UPLOAD',
          message: isLarge
            ? 'Product images must be 5 MB or smaller.'
            : 'Choose one product image and try again.',
        },
      })
      return
    }

    next(error)
  })
}
