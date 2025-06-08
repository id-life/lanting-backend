import KeyvRedis from "@keyv/redis"
import { CacheModule } from "@nestjs/cache-manager"
import { Global, Module } from "@nestjs/common"
import Keyv from "keyv"
import { ConfigService } from "../../config/config.service"
import { RedisService } from "./redis.service"

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = `redis://${configService.redisPassword ? `${configService.redisPassword}@` : ""}${configService.redisHost}:${configService.redisPort}/${configService.redisDb}`

        const keyvRedis = new KeyvRedis(redisUrl)

        return {
          store: () => new Keyv({ store: keyvRedis }),
          ttl: 0, // 默认不过期，可以在使用时指定
        }
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
