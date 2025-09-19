import { Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { ArchivesModule } from "./archives/archives.module"
import { AuthModule } from "./auth/auth.module"
import { CommonModule } from "./common/common.module"
import { ConfigModule } from "./config/config.module"
import { EmailModule } from "./email/email.module"
import { TributeModule } from "./tribute/tribute.module"

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    ArchivesModule,
    TributeModule,
    CommonModule,
    EmailModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
