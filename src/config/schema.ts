import { z } from "zod"

export const appConfigSchema = z.object({
  PORT: z.coerce
    .number()
    .min(1024, "Port must be >= 1024")
    .max(65535, "Port must be <= 65535")
    .refine((val) => val !== 0, "Port cannot be 0")
    .catch(8000),
  API_PREFIX: z.string().optional(),
  DATABASE_URL: z.string().url().optional(),
})

export type AppConfig = z.infer<typeof appConfigSchema>
