import { appConfigSchema } from "./schema"

describe("migration runtime configuration", () => {
  const base = { JWT_SECRET: "x".repeat(32) }

  it("keeps the email listener and scheduler disabled by default", () => {
    expect(appConfigSchema.parse(base).EMAIL_WORKER_ENABLED).toBe(false)
  })

  it("requires an explicit true value to enable the email worker", () => {
    expect(
      appConfigSchema.parse({
        ...base,
        EMAIL_WORKER_ENABLED: "true",
      }).EMAIL_WORKER_ENABLED,
    ).toBe(true)
  })
})
