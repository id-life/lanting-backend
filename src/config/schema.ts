import { z } from "zod"

export const appConfigSchema = z.object({
  // common
  PORT: z.coerce
    .number()
    .min(1024, "Port must be >= 1024")
    .max(65535, "Port must be <= 65535")
    .refine((val) => val !== 0, "Port cannot be 0")
    .catch(8000),
  API_PREFIX: z.string().optional(),

  // database
  DATABASE_URL: z.string().url().optional(),

  // deepseek
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL_NAME: z.string().default("deepseek/deepseek-v3-turbo"),

  // aws
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ACCESS_KEY: z.string().optional(),
  AWS_S3_SECRET_KEY: z.string().optional(),
  AWS_S3_DIRECTORY: z.string().default("archives"),

  // redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // swagger
  SWAGGER_ENABLED: z
    .preprocess((v) => v === "true", z.boolean())
    .default(false),
})

export type AppConfig = z.infer<typeof appConfigSchema>
