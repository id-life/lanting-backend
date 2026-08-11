import { HealthController } from "./health.controller"

describe("HealthController migration contract", () => {
  const status = jest.fn()
  const response = { status } as any
  const prisma = { $queryRawUnsafe: jest.fn() }
  const redisClient = { ping: jest.fn() }
  const redis = { getClient: () => redisClient }
  const controller = new HealthController(prisma as any, redis as any)

  beforeEach(() => jest.clearAllMocks())

  it("keeps liveness dependency-free", () => {
    expect(controller.healthz()).toEqual({
      ok: true,
      service: "lanting-backend",
    })
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled()
    expect(redisClient.ping).not.toHaveBeenCalled()
  })

  it("uses read-only dependency checks for readiness", async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ 1: 1 }])
    redisClient.ping.mockResolvedValue("PONG")

    await expect(controller.readyz(response)).resolves.toEqual({
      ok: true,
      database: true,
      redis: true,
    })
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1")
    expect(redisClient.ping).toHaveBeenCalledTimes(1)
    expect(status).not.toHaveBeenCalled()
  })

  it("fails closed without exposing dependency errors", async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error("sensitive detail"))
    redisClient.ping.mockResolvedValue("PONG")

    await expect(controller.readyz(response)).resolves.toEqual({
      ok: false,
      database: false,
      redis: false,
    })
    expect(status).toHaveBeenCalledWith(503)
  })
})
