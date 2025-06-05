import { Module } from "@nestjs/common"
import { TributeController } from "./tribute.controller"
import { TributeService } from "./tribute.service"

@Module({
  controllers: [TributeController],
  providers: [TributeService],
})
export class TributeModule {}
