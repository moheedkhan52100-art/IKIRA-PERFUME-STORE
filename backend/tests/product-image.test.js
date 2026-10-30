import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  detectSupportedProductImage,
} from '../controllers/productImageController.js'

test('product image validation accepts PNG signatures that match the declared type', async () => {
  const detectedType = await detectSupportedProductImage(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pysAAAAASUVORK5CYII=',
      'base64',
    ),
    'image/png',
  )

  assert.equal(detectedType.mime, 'image/png')
  assert.equal(detectedType.ext, 'png')
})

test('product image validation rejects unsupported, spoofed, and empty uploads', async () => {
  assert.equal(
    await detectSupportedProductImage(Buffer.from('<svg></svg>'), 'image/svg+xml'),
    null,
  )
  assert.equal(
    await detectSupportedProductImage(
      Buffer.from('89504e470d0a1a0a', 'hex'),
      'image/jpeg',
    ),
    null,
  )
  assert.equal(await detectSupportedProductImage(Buffer.alloc(0), 'image/png'), null)
})
