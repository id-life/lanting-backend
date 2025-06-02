import { Global, Module } from "@nestjs/common"
import { ConfigModule as NestConfigModule } from "@nestjs/config"
import { ConfigService } from "./config.service"
import { configLoader } from "./loader"

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [configLoader],
      isGlobal: true,
      cache: true,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService, NestConfigModule],
})
export class ConfigModule {}
