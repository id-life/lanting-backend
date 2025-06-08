import { HttpModule } from "@nestjs/axios"
import { Module } from "@nestjs/common"
import { TributeController } from "./tribute.controller"
import { TributeService } from "./tribute.service"

@Module({
  imports: [HttpModule],
  controllers: [TributeController],
  providers: [TributeService],
})
export class TributeModule {}
