import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBody, ApiConsumes } from "@nestjs/swagger"
import { multerConfig } from "@/config/configuration/multer.config"
import { TributeFileUploadDto } from "./dto/file-upload.dto"
import { TributeService } from "./tribute.service"

@Controller("tribute")
export class TributeController {
  constructor(private readonly tributeService: TributeService) {}

  @Get("info")
  getInfo(@Query("link") link: string) {
    return this.tributeService.getInfo(link)
  }

  @Post("extract-html")
  @ApiBody({ type: TributeFileUploadDto })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerConfig))
  extractHtml(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({
        success: false,
        message: "File is required",
      })
    }

    return this.tributeService.extractHtml(file)
  }
}
