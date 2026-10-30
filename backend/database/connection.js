import mongoose from 'mongoose'
import { env } from '../config/env.js'

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

export function getDatabaseStatus() {
  if (!env.mongoUri) {
    return 'not_configured'
  }

  return connectionStates[mongoose.connection.readyState] ?? 'unknown'
}

export async function connectToDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI must be configured before connecting to MongoDB.')
  }

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 })
  console.log('Connected to MongoDB.')
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}
