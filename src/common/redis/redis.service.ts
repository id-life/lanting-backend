import { Injectable, Logger } from "@nestjs/common"
import { Redis } from "ioredis"
import { ConfigService } from "../../config/config.service"

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name)
  private readonly client: Redis

  constructor(private readonly configService: ConfigService) {
    const redisConfig: any = {
      host: this.configService.redisHost,
      port: this.configService.redisPort,
      db: this.configService.redisDb,
      maxRetriesPerRequest: 3,
    }

    if (this.configService.redisPassword) {
      redisConfig.password = this.configService.redisPassword
    }

    this.client = new Redis(redisConfig)

    this.client.on("connect", () => {
      this.logger.log("Redis connected successfully")
    })

    this.client.on("error", (error) => {
      this.logger.error("Redis connection error:", error)
    })
  }

  getClient(): Redis {
    return this.client
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key)
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key)
  }

  async exists(key: string): Promise<number> {
    return await this.client.exists(key)
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds)
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key)
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern)
  }

  async onModuleDestroy() {
    await this.client.quit()
  }
}
