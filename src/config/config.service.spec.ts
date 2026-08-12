import { ConfigService } from "./config.service"

describe("ConfigService Redis TLS", () => {
  const service = (values: Record<string, unknown>) =>
    new ConfigService({
      get: (key: string) => values[key],
    } as never)

  it("automatically enables TLS for AWS ElastiCache endpoints", () => {
    expect(
      service({
        "app.REDIS_HOST": "master.example.cache.amazonaws.com",
        "app.REDIS_TLS": undefined,
      }).redisTls,
    ).toBe(true)
  })

  it("honors an explicit override for non-AWS or local Redis", () => {
    expect(
      service({
        "app.REDIS_HOST": "localhost",
        "app.REDIS_TLS": false,
      }).redisTls,
    ).toBe(false)
  })
})
