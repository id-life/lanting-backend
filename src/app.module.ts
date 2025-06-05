import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ArchivesModule } from "./archives/archives.module"
import { ConfigModule } from "./config/config.module"

@Module({
  imports: [ConfigModule, ArchivesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
