import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { ConfigService } from "./config/config.service"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )

  let serverURL = `http://localhost:${configService.port}`

  if (configService.apiPrefix) {
    app.setGlobalPrefix(configService.apiPrefix)
    serverURL += configService.apiPrefix
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

  await app.listen(configService.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running at ${serverURL}`)
  })
}

bootstrap()
