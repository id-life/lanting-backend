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
}
