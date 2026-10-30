import catalog from '../../frontend/src/data/products.js'
import { connectToDatabase, disconnectFromDatabase } from '../database/connection.js'
import { env } from '../config/env.js'
import { Product } from '../models/Product.js'

async function seedProducts() {
  await connectToDatabase()

  const operations = catalog.map(({ id, isNew, collection, ...product }) => ({
    updateOne: {
      filter: { slug: id },
      update: {
        $setOnInsert: {
          ...product,
          slug: id,
          newArrival: isNew,
          collectionName: collection,
        },
      },
      upsert: true,
    },
  }))

  const result = await Product.bulkWrite(operations, { ordered: false })
  console.log(
    `Product seed complete: ${result.upsertedCount} inserted, ${result.matchedCount} already present.`,
  )
}

seedProducts()
  .catch((error) => {
    const rawMessage = String(error?.message ?? error)
    const message = env.mongoUri ? rawMessage.replace(env.mongoUri, '[redacted]') : rawMessage
    console.error('Product seeding failed:', message)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await disconnectFromDatabase()
    } catch {
      console.error('MongoDB could not disconnect after product seeding.')
      process.exitCode = 1
    }
  })
