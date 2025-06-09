import { Logger, ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { ConfigService } from "./config/config.service"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const logger = new Logger("Bootstrap")

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )

  if (configService.apiPrefix) {
    app.setGlobalPrefix(configService.apiPrefix)
  }
  app.enableCors()

  if (configService.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Lanting API")
      .setDescription("API documentation for Lanting")
      .setVersion("1.0")
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    })
    SwaggerModule.setup("docs", app, document)
  }

  await app.listen(configService.port)

  const actualUrl = await app.getUrl()
  let apiUrl = actualUrl

  if (configService.apiPrefix) {
    apiUrl += configService.apiPrefix
  }

  logger.log(`Server is running at ${apiUrl}`)

  if (configService.swaggerEnabled) {
    logger.log(`Swagger is available at ${actualUrl}/docs`)
  }
}

bootstrap()
