import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ArchivesModule } from "./archives/archives.module"
import { ConfigModule } from "./config/config.module"
import { TributeModule } from "./tribute/tribute.module"

@Module({
  imports: [ConfigModule, ArchivesModule, TributeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
