import { Controller, Get, Res } from "@nestjs/common"
import type { Response } from "express"
import { PrismaService } from "../common/prisma/prisma.service"
import { RedisService } from "../common/redis/redis.service"

const READY_TIMEOUT_MS = 2_000

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("readiness timeout")),
      READY_TIMEOUT_MS,
    )

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get("healthz")
  healthz() {
    return { ok: true, service: "lanting-backend-bio" }
  }

  @Get("readyz")
  async readyz(@Res({ passthrough: true }) response: Response) {
    try {
      await withTimeout(
        Promise.all([
          this.prisma.$queryRawUnsafe("SELECT 1"),
          this.redis.getClient().ping(),
        ]),
      )
      return { ok: true, database: true, redis: true }
    } catch {
      response.status(503)
      return { ok: false, database: false, redis: false }
    }
  }
}
