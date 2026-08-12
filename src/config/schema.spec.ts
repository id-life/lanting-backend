import { appConfigSchema } from "./schema"

describe("Redis TLS configuration", () => {
  const base = { JWT_SECRET: "x".repeat(32) }

  it("leaves TLS unset for host-based ElastiCache detection", () => {
    expect(appConfigSchema.parse(base).REDIS_TLS).toBeUndefined()
    expect(appConfigSchema.parse({ ...base, REDIS_TLS: "false" }).REDIS_TLS).toBe(false)
  })

  it("enables TLS for ElastiCache when explicitly configured", () => {
    expect(appConfigSchema.parse({ ...base, REDIS_TLS: "true" }).REDIS_TLS).toBe(true)
  })
})
