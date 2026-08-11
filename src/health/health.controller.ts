import { Controller, Get, Res } from "@nestjs/common"
import type { Response } from "express"
import { PrismaService } from "../common/prisma/prisma.service"
import { RedisService } from "../common/redis/redis.service"

const READY_TIMEOUT_MS = 2_000

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get("healthz")
  healthz() {
    return { ok: true, service: "lanting-backend" }
  }

  @Get("readyz")
  async readyz(@Res({ passthrough: true }) response: Response) {
    try {
      await Promise.race([
        Promise.all([
          this.prisma.$queryRawUnsafe("SELECT 1"),
          this.redis.getClient().ping(),
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("readiness timeout")), READY_TIMEOUT_MS),
        ),
      ])
      return { ok: true, database: true, redis: true }
    } catch {
      response.status(503)
      return { ok: false, database: false, redis: false }
    }
  }
}
