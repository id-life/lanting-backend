import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ConfigService } from "./config/config.service"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  let serverURL = `http://localhost:${configService.port}`

  if (configService.apiPrefix) {
    app.setGlobalPrefix(configService.apiPrefix)
    serverURL += configService.apiPrefix
  }
  app.enableCors()

  await app.listen(configService.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running at ${serverURL}`)
  })
}

bootstrap()
