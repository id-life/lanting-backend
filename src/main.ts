import process from "node:process"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const PORT = process?.env.PORT ?? 8000

  await app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running at http://localhost:${PORT}`)
  })
}

bootstrap()
