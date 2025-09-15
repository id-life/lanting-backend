import { Injectable } from "@nestjs/common"
import { ConfigService as NestConfigService } from "@nestjs/config"
import { AppConfig } from "./schema"

@Injectable()
export class ConfigService {
  constructor(
    private readonly nestConfigService: NestConfigService<
      { app: AppConfig },
      true
    >,
  ) {}

  get port() {
    return this.nestConfigService.get("app.PORT", { infer: true })
  }

  get apiPrefix() {
    return this.nestConfigService.get("app.API_PREFIX", { infer: true })
  }

  get fallbackUserAgent() {
    return this.nestConfigService.get("app.FALLBACK_USER_AGENT", {
      infer: true,
    })
  }

  get databaseUrl() {
    return this.nestConfigService.get("app.DATABASE_URL", { infer: true })
  }

  get deepSeekApiKey() {
    return this.nestConfigService.get("app.DEEPSEEK_API_KEY", { infer: true })
  }

  get deepSeekModelName() {
    return this.nestConfigService.get("app.DEEPSEEK_MODEL_NAME", {
      infer: true,
    })
  }

  get awsS3Bucket() {
    return this.nestConfigService.get("app.AWS_S3_BUCKET", { infer: true })
  }

  get awsS3AccessKey() {
    return this.nestConfigService.get("app.AWS_S3_ACCESS_KEY", { infer: true })
  }

  get awsS3SecretKey() {
    return this.nestConfigService.get("app.AWS_S3_SECRET_KEY", { infer: true })
  }

  get awsS3Directory() {
    return this.nestConfigService.get("app.AWS_S3_DIRECTORY", { infer: true })
  }

  get redisHost() {
    return this.nestConfigService.get("app.REDIS_HOST", { infer: true })
  }

  get redisPort() {
    return this.nestConfigService.get("app.REDIS_PORT", { infer: true })
  }

  get redisPassword() {
    return this.nestConfigService.get("app.REDIS_PASSWORD", { infer: true })
  }

  get redisDb() {
    return this.nestConfigService.get("app.REDIS_DB", { infer: true })
  }

  get swaggerEnabled() {
    return this.nestConfigService.get("app.SWAGGER_ENABLED", { infer: true })
  }

  get githubClientId() {
    return this.nestConfigService.get("app.GITHUB_CLIENT_ID", { infer: true })
  }

  get githubClientSecret() {
    return this.nestConfigService.get("app.GITHUB_CLIENT_SECRET", {
      infer: true,
    })
  }

  get githubCallbackUrl() {
    return this.nestConfigService.get("app.GITHUB_CALLBACK_URL", {
      infer: true,
    })
  }

  get jwtSecret() {
    return this.nestConfigService.get("app.JWT_SECRET", { infer: true })
  }

  get frontendUrl() {
    return this.nestConfigService.get("app.FRONTEND_URL", { infer: true })
  }
}
