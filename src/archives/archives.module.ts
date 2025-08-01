import { Module } from "@nestjs/common"
import { ArchivesController } from "./archives.controller"
import { ArchivesService } from "./archives.service"

@Module({
  controllers: [ArchivesController],
  providers: [ArchivesService],
  exports: [ArchivesService],
})
export class ArchivesModule {}
