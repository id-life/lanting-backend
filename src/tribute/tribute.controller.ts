import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { Request } from "express"
import { CurrentUser } from "@/auth/decorators/user.decorator"
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard"
import { ConfigService } from "@/config/config.service"
import { multerConfig } from "@/config/configuration/multer.config"
import { TributeFileUploadDto } from "./dto/file-upload.dto"
import { TributeService } from "./tribute.service"

@ApiTags("tribute")
@Controller("tribute")
export class TributeController {
  constructor(
    private readonly tributeService: TributeService,
    private readonly configService: ConfigService,
  ) {}

  @Get("info")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取链接信息" })
  @ApiQuery({
    name: "link",
    description: "需要提取信息的链接",
    example: "https://example.com/article",
  })
  @ApiResponse({
    status: 200,
    description: "返回链接的元数据信息",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            title: { type: "string", example: "文章标题" },
            author: { type: "string", example: "作者姓名" },
            publisher: { type: "string", example: "出版方" },
            date: { type: "string", example: "2025-01-01" },
            summary: { type: "string", example: "文章摘要内容..." },
            keywords: {
              type: "object",
              properties: {
                predefined: {
                  type: "array",
                  items: { type: "string" },
                  example: [],
                },
                extracted: {
                  type: "array",
                  items: { type: "string" },
                  example: ["关键词1", "关键词2"],
                },
              },
            },
          },
        },
        message: {
          type: "string",
          example: "Tribute info retrieved successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "获取链接信息失败",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Failed to fetch tribute info: ...",
        },
      },
    },
  })
  getInfo(
    @Query("link") link: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userAgent =
      req.headers["user-agent"] || this.configService.fallbackUserAgent
    return this.tributeService.getInfo(link, userAgent)
  }

  @Post("extract-html")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "从HTML文件提取内容" })
  @ApiResponse({
    status: 200,
    description: "返回提取的HTML内容",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            title: { type: "string", example: "文章标题" },
            author: { type: "string", example: "作者姓名" },
            publisher: { type: "string", example: "出版方" },
            date: { type: "string", example: "2025-01-01" },
            summary: { type: "string", example: "文章摘要内容..." },
            keywords: {
              type: "object",
              properties: {
                predefined: {
                  type: "array",
                  items: { type: "string" },
                  example: [],
                },
                extracted: {
                  type: "array",
                  items: { type: "string" },
                  example: ["关键词1", "关键词2"],
                },
              },
            },
          },
        },
        message: {
          type: "string",
          example: "HTML content extracted successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "文件是必需的",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "File is required" },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "HTML提取失败",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Failed to extract HTML: ...",
        },
      },
    },
  })
  @ApiBody({ type: TributeFileUploadDto })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerConfig))
  extractHtml(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        success: false,
        message: "File is required",
      })
    }

    return this.tributeService.extractHtml(file)
  }
}
