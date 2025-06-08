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
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { multerConfig } from "@/config/configuration/multer.config"
import { TributeFileUploadDto } from "./dto/file-upload.dto"
import { TributeService } from "./tribute.service"

@ApiTags("tribute")
@Controller("tribute")
export class TributeController {
  constructor(private readonly tributeService: TributeService) {}

  @Get("info")
  @ApiOperation({ summary: "获取链接信息" })
  @ApiQuery({ name: "link", description: "需要提取信息的链接" })
  @ApiResponse({ status: 200, description: "返回链接的元数据信息" })
  getInfo(@Query("link") link: string) {
    return this.tributeService.getInfo(link)
  }

  @Post("extract-html")
  @ApiOperation({ summary: "从HTML文件提取内容" })
  @ApiResponse({ status: 200, description: "返回提取的HTML内容" })
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
