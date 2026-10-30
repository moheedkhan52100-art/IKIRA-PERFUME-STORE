import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectToDatabase, disconnectFromDatabase } from './database/connection.js'
import { startOrderNotificationWorker } from './services/orderNotifications.js'

async function startServer() {
  if (env.mongoUri) {
    await connectToDatabase()
  } else {
    console.warn(
      'MongoDB is not configured. Add MONGODB_URI to backend/.env before using database-backed features.',
    )
  }

  const server = createApp().listen(env.port, () => {
    console.log(`IKIRA API listening on http://localhost:${env.port}`)
  })
  const stopOrderNotificationWorker = env.mongoUri
    ? startOrderNotificationWorker()
    : () => {}

  server.on('error', (error) => {
    console.error('The IKIRA API could not start.', error)
    process.exitCode = 1
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async (error) => {
        if (error) {
          console.error('The IKIRA API could not shut down cleanly.', error)
          process.exitCode = 1
          return
        }

        try {
          stopOrderNotificationWorker()
          await disconnectFromDatabase()
          console.log('IKIRA API stopped.')
        } catch (disconnectError) {
          console.error('The IKIRA API database connection could not close cleanly.', disconnectError)
          process.exitCode = 1
        }
      })
    })
  }
}

startServer().catch((error) => {
  console.error('The IKIRA API could not start.', error)
  process.exitCode = 1
})
