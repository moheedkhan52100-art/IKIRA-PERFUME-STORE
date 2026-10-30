import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

function optionalString(schema = z.string().trim().min(1)) {
  return z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema.optional(),
  )
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: optionalString(
    z.string().trim().min(1).refine(
      (uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
      'must be a MongoDB connection URI',
    ),
  ),
  CLIENT_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((origins) => origins.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.string().url()).min(1)),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  ADMIN_USERNAME: optionalString(z.string().trim().min(3)),
  ADMIN_PASSWORD: optionalString(z.string().min(16)),
  ADMIN_SESSION_SECRET: optionalString(z.string().min(32)),
  CUSTOMER_SESSION_SECRET: optionalString(z.string().min(32)),
  SMTP_HOST: optionalString(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: optionalString(),
  SMTP_PASSWORD: optionalString(z.string().min(1)),
  SMTP_FROM: optionalString(z.string().trim().email()),
  STORE_NOTIFICATION_EMAIL: optionalString(z.string().trim().email()),
}).superRefine((values, context) => {
  if (
    values.NODE_ENV === 'production' &&
    values.CLIENT_ORIGINS.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))
  ) {
    context.addIssue({
      code: 'custom',
      path: ['CLIENT_ORIGINS'],
      message: 'must contain deployed browser origins, not localhost origins, in production',
    })
  }

  const requiredInProduction = [
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'ADMIN_SESSION_SECRET',
    'CUSTOMER_SESSION_SECRET',
    'MONGODB_URI',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'STORE_NOTIFICATION_EMAIL',
  ]
  const emailSettings = [
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'STORE_NOTIFICATION_EMAIL',
  ]
  const emailIsPartiallyConfigured = emailSettings.some((key) => values[key])

  for (const key of requiredInProduction) {
    if (values.NODE_ENV !== 'production') continue
    if (!values[key]) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: 'is required in production',
      })
    }
  }

  if (emailIsPartiallyConfigured) {
    for (const key of emailSettings) {
      if (!values[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'must be configured together with the other SMTP settings',
        })
      }
    }
  }
})

const environmentResult = environmentSchema.safeParse(process.env)

if (!environmentResult.success) {
  console.error('Invalid backend environment configuration:')
  for (const issue of environmentResult.error.issues) {
    console.error(`- ${issue.path.join('.') || 'environment'}: ${issue.message}`)
  }
  process.exit(1)
}

const values = environmentResult.data

export const env = {
  clientOrigins: values.CLIENT_ORIGINS,
  adminPassword: values.ADMIN_PASSWORD,
  adminSessionSecret: values.ADMIN_SESSION_SECRET,
  adminUsername: values.ADMIN_USERNAME,
  customerSessionSecret: values.CUSTOMER_SESSION_SECRET,
  mongoUri: values.MONGODB_URI,
  nodeEnv: values.NODE_ENV,
  port: values.PORT,
  rateLimitMax: values.RATE_LIMIT_MAX,
  rateLimitWindowMs: values.RATE_LIMIT_WINDOW_MS,
  email: {
    from: values.SMTP_FROM,
    host: values.SMTP_HOST,
    password: values.SMTP_PASSWORD,
    port: values.SMTP_PORT,
    secure: values.SMTP_SECURE,
    storeRecipient: values.STORE_NOTIFICATION_EMAIL,
    user: values.SMTP_USER,
  },
  emailConfigured: Boolean(
    values.SMTP_HOST &&
    values.SMTP_USER &&
    values.SMTP_PASSWORD &&
    values.SMTP_FROM &&
    values.STORE_NOTIFICATION_EMAIL,
  ),
}
