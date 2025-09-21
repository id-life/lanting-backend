import { Buffer } from "node:buffer"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common"
import { FilesInterceptor } from "@nestjs/platform-express"
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { User } from "@prisma/client"
import { Request, Response } from "express"
import { CurrentUser } from "@/auth/decorators/user.decorator"
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard"
import { ConfigService } from "@/config/config.service"
import { multerConfig } from "@/config/configuration/multer.config"
import { ArchivesService } from "./archives.service"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { ArchiveFileUploadDto } from "./dto/file-upload.dto"
import { LikeArchiveDto } from "./dto/like-archive.dto"
import { QueryPendingOrigsDto } from "./dto/query-pending-origs.dto"
import { SearchKeywordDto } from "./dto/search-keyword.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"

@ApiTags("archives")
@Controller("archives")
export class ArchivesController {
  constructor(
    private readonly archivesService: ArchivesService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "创建新归档",
    description:
      "支持多文件上传，每个文件可以关联一个可选的原始URL。支持四种模式：1) 纯文件上传 2) 文件+对应原始URL 3) 仅通过原始URL抓取内容 4) 使用已上传的待处理文件",
  })
  @ApiResponse({
    status: 201,
    description: "归档创建成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 123 },
            title: {
              type: "string",
              example: "完整归档示例：前端开发最佳实践",
            },
            authors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
              },
              example: [
                { id: 1, name: "前端专家" },
                { id: 2, name: "UI设计师" },
              ],
            },
            publisher: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
              nullable: true,
              example: { id: 1, name: "前端技术社区" },
            },
            date: {
              type: "object",
              properties: {
                id: { type: "number" },
                value: { type: "string" },
              },
              nullable: true,
              example: { id: 1, value: "2025-07-23" },
            },
            chapter: { type: "string", example: "群像" },
            tags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
              },
              example: [
                { id: 1, name: "前端" },
                { id: 2, name: "Vue" },
                { id: 3, name: "React" },
              ],
            },
            remarks: {
              type: "string",
              nullable: true,
              example: "这是一个包含所有字段的完整归档示例",
            },
            origs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  originalUrl: { type: "string", nullable: true },
                  storageUrl: { type: "string" },
                  fileType: { type: "string", nullable: true },
                  storageType: { type: "string" },
                },
              },
              example: [
                {
                  id: 1,
                  originalUrl:
                    "https://frontend.example.com/vue-best-practices",
                  storageUrl: "vue_best_practices_20250723.pdf",
                  fileType: "pdf",
                  storageType: "s3",
                },
              ],
            },
            likes: { type: "number", example: 0 },
          },
        },
        message: { type: "string", example: "Archive created successfully" },
      },
    },
    examples: {
      "complete-response": {
        summary: "完整字段响应示例",
        value: {
          success: true,
          data: {
            id: 123,
            title: "完整归档示例：前端开发最佳实践",
            authors: [
              { id: 1, name: "前端专家" },
              { id: 2, name: "UI设计师" },
              { id: 3, name: "架构师" },
            ],
            publisher: { id: 1, name: "前端技术社区" },
            date: { id: 1, value: "2025-07-23" },
            chapter: "群像",
            tags: [
              { id: 1, name: "前端" },
              { id: 2, name: "Vue" },
              { id: 3, name: "React" },
              { id: 4, name: "TypeScript" },
              { id: 5, name: "最佳实践" },
            ],
            remarks: "这是一个包含所有字段的完整归档示例",
            origs: [
              {
                id: 1,
                originalUrl: "https://frontend.example.com/vue-best-practices",
                storageUrl: "vue_best_practices_20250723.pdf",
                fileType: "pdf",
                storageType: "s3",
              },
              {
                id: 2,
                originalUrl: "https://frontend.example.com/react-performance",
                storageUrl: "react_performance_guide.html",
                fileType: "html",
                storageType: "s3",
              },
              {
                id: 3,
                originalUrl: null, // 本地上传文件无原始URL
                storageUrl: "typescript_manual.md",
                fileType: "md",
                storageType: "s3",
              },
            ],
            likes: 0,
          },
          message: "Archive created successfully",
        },
      },
      "simple-response": {
        summary: "简单响应示例",
        value: {
          success: true,
          data: {
            id: 124,
            title: "技术文档",
            authors: [{ id: 4, name: "技术作者" }],
            publisher: null,
            date: null,
            chapter: "本纪",
            tags: [],
            remarks: null,
            origs: [
              {
                id: 4,
                originalUrl: null,
                storageUrl: "document.pdf",
                fileType: "pdf",
                storageType: "s3",
              },
            ],
            likes: 0,
          },
          message: "Archive created successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example:
            "At least one of the following must be provided: files (for file upload), originalUrls (for URL fetching), or pendingOrigIds (for pending files)",
        },
      },
    },
  })
  @ApiBody({
    type: ArchiveFileUploadDto,
    description: "支持多文件上传的归档创建请求",
    examples: {
      "minimal-required": {
        summary: "最小必填字段",
        description: "只包含必填字段的最简示例",
        value: {
          title: "最简归档示例",
          chapter: "本纪",
          // files: "至少需要上传1个文件或提供1个URL"
        },
      },
      "files-only": {
        summary: "纯文件上传",
        description: "只上传文件，不提供原始URL，包含所有可选字段",
        value: {
          title: "本地技术文档合集",
          chapter: "本纪",
          authors: ["张三", "李四", "王五"],
          publisher: "技术出版社",
          date: "2025-07-23",
          tags: ["技术", "编程", "开发", "教程"],
          remarks: "这是一份重要的技术文档归档，包含多个本地上传的文件",
          // files: "通过表单上传的文件数组（最多10个文件）"
        },
      },
      "files-with-urls": {
        summary: "文件+原始URL",
        description: "上传文件同时提供对应的原始URL，完整字段示例",
        value: {
          title: "网页内容备份归档",
          chapter: "列传",
          authors: ["网站编辑", "内容管理员"],
          publisher: "某某网站",
          date: "2025-07-23",
          tags: ["网页", "备份", "归档", "在线内容"],
          remarks: "重要网页内容的本地备份，保存原始URL用于追溯",
          originalUrls: [
            "https://example.com/important-article",
            "https://example.com/technical-guide",
            "https://example.com/tutorial-series",
          ],
          // files: "通过表单上传的文件数组，与originalUrls一一对应"
        },
      },
      "urls-only": {
        summary: "仅URL抓取",
        description: "不上传文件，仅提供URL让系统抓取内容，完整字段示例",
        value: {
          title: "在线资源自动抓取归档",
          chapter: "搜神",
          authors: ["在线作者1", "在线作者2"],
          publisher: "互联网",
          date: "2025-07-23",
          tags: ["自动抓取", "在线资源", "实时内容"],
          remarks: "通过URL自动抓取的在线内容，系统会自动获取并保存",
          originalUrls: [
            "https://example.com/api-documentation",
            "https://example.com/best-practices",
            "https://example.com/community-guide",
          ],
        },
      },
      "pending-files-only": {
        summary: "纯待处理文件模式",
        description: "只使用已上传到AWS的待处理文件创建归档",
        value: {
          title: "邮件附件归档",
          chapter: "列传",
          authors: ["邮件发送者"],
          publisher: "邮件系统",
          date: "2025-07-23",
          tags: ["邮件附件", "待处理文件"],
          remarks: "使用邮件系统预处理的文件创建归档",
          pendingOrigIds: [123, 456, 789], // 使用待处理文件ID
          originalUrls: ["", "", ""], // 对应位置留空
          // files: 无需上传新文件
        },
      },
      "mixed-with-pending": {
        summary: "包含待处理文件的混合模式",
        description: "待处理文件与新上传文件、URL抓取的完整混合模式",
        value: {
          title: "混合内容归档：待处理+新上传+URL抓取",
          chapter: "群像",
          authors: ["混合作者1", "混合作者2", "邮件作者"],
          publisher: "综合平台",
          date: "2025-07-23",
          tags: ["混合模式", "待处理文件", "新上传", "URL抓取"],
          remarks:
            "演示完整混合模式：位置0=待处理文件，位置1=URL抓取，位置2=新上传文件，位置3=待处理文件",
          pendingOrigIds: [123, null, null, 456], // 位置0和3使用待处理文件
          originalUrls: ["", "https://example.com/online-content", "", ""], // 位置1 URL抓取
          // files[2]: 位置2上传新文件
        },
      },
      "mixed-mode": {
        summary: "传统混合模式",
        description:
          "支持文件与URL的灵活组合：可以只有文件、只有URL、或两者都有。按索引位置一一对应。",
        value: {
          title: "混合内容归档：本地文件+在线资源",
          chapter: "群像",
          authors: ["混合作者1", "混合作者2", "本地作者"],
          publisher: "技术社区",
          date: "2025-07-23",
          tags: ["混合模式", "本地文件", "在线资源", "综合归档"],
          remarks:
            "演示传统混合模式：位置0=URL抓取，位置1=本地文件+URL，位置2=仅本地文件，位置3=仅URL抓取",
          originalUrls: [
            "https://example.com/online-only", // 位置0: 仅URL，无文件上传
            "https://example.com/with-backup", // 位置1: 有URL也有文件上传
            "", // 位置2: 仅文件上传，无URL
            "https://example.com/another-online", // 位置3: 仅URL，无文件上传
          ],
          pendingOrigIds: [null, null, null, null], // 不使用待处理文件
          // 对应的files上传：
          // files[0]: 无（仅URL抓取）
          // files[1]: 有文件（本地备份，同时保留原始URL）
          // files[2]: 有文件（纯本地文件）
          // files[3]: 无（仅URL抓取）
        },
      },
      "all-chapters": {
        summary: "所有章节类别示例",
        description: "展示所有可用的章节类别",
        value: {
          title: "章节类别演示",
          chapter: "世家", // 使用不同的章节
          authors: ["史学家", "编纂者"],
          publisher: "史书出版社",
          date: "2025-07-23",
          tags: ["史书", "世家", "传记"],
          remarks: "可用章节：本纪、世家、搜神、列传、游侠、群像、随园食单",
          originalUrls: ["https://example.com/historical-content"],
        },
      },
      "single-author": {
        summary: "单作者示例",
        description: "只有一个作者的简单示例",
        value: {
          title: "个人技术博客归档",
          chapter: "随园食单",
          authors: ["技术博主"],
          publisher: "个人博客",
          date: "2025-07-23",
          tags: ["个人博客", "技术分享"],
          remarks: "个人技术博客的精选内容归档",
          originalUrls: ["https://blog.example.com/tech-posts"],
        },
      },
      "no-optional-fields": {
        summary: "无可选字段",
        description: "只包含必填字段，不包含任何可选字段",
        value: {
          title: "纯净归档示例",
          chapter: "游侠",
          originalUrls: ["https://example.com/simple-content"],
          pendingOrigIds: [null], // 对应位置不使用待处理文件
        },
      },
      "max-fields": {
        summary: "最大字段数量",
        description: "包含最多作者、标签等字段的示例",
        value: {
          title: "大型项目文档归档：企业级前端架构设计与实现指南",
          chapter: "群像",
          authors: [
            "首席架构师",
            "前端团队负责人",
            "UI/UX设计师",
            "产品经理",
            "技术文档工程师",
            "质量保证工程师",
            "DevOps工程师",
            "项目经理",
          ],
          publisher: "企业技术部门",
          date: "2025-07-23",
          tags: [
            "企业级",
            "前端架构",
            "Vue.js",
            "React",
            "Angular",
            "TypeScript",
            "Webpack",
            "微前端",
            "组件库",
            "设计系统",
            "性能优化",
            "最佳实践",
            "代码规范",
            "自动化测试",
            "CI/CD",
            "文档管理",
          ],
          remarks:
            "这是一个企业级前端项目的完整技术文档归档，包含了从架构设计到具体实现的全套资料。文档涵盖了技术选型、架构设计、开发规范、测试策略、部署流程等各个方面，是团队协作和知识传承的重要资料。",
          originalUrls: [
            "https://company.example.com/frontend-architecture-guide",
            "https://company.example.com/component-library-docs",
            "https://company.example.com/performance-optimization",
            "https://company.example.com/testing-strategy",
            "https://company.example.com/deployment-guide",
          ],
          pendingOrigIds: [null, null, null, null, null], // 不使用待处理文件
          // files: "对应5个文件：架构指南.pdf、组件库文档.html、性能优化手册.md、测试策略.docx、部署指南.txt"
        },
      },
    },
  })
  @ApiConsumes("multipart/form-data")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    }),
  )
  @UseInterceptors(FilesInterceptor("files", 10, multerConfig)) // 支持最多10个文件上传，每个文件可关联originalUrl
  create(
    @Body() createArchiveDto: CreateArchiveDto,
    @CurrentUser() user: User,
    @Req() req: Request,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const userAgent =
      req.headers["user-agent"] || this.configService.fallbackUserAgent
    return this.archivesService.create(createArchiveDto, user, userAgent, files)
  }

  @Get()
  @ApiOperation({ summary: "获取所有归档" })
  @ApiResponse({
    status: 200,
    description: "返回所有归档",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              authors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    name: { type: "string" },
                  },
                },
              },
              publisher: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
                nullable: true,
              },
              date: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  value: { type: "string" },
                },
                nullable: true,
              },
              chapter: { type: "string" },
              tags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    name: { type: "string" },
                  },
                },
              },
              remarks: { type: "string", nullable: true },
              origs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    originalUrl: { type: "string", nullable: true },
                    storageUrl: { type: "string" },
                    fileType: { type: "string", nullable: true },
                    storageType: { type: "string" },
                  },
                },
              },
              likes: { type: "number" },
            },
          },
        },
        message: { type: "string", example: "Archives retrieved successfully" },
      },
    },
  })
  findAll() {
    return this.archivesService.findAll()
  }

  @Get("chapters")
  @ApiOperation({ summary: "获取所有有效的章节类别" })
  @ApiResponse({
    status: 200,
    description: "返回所有有效的章节类别",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: { type: "string" },
          example: ["本纪", "世家", "搜神", "列传", "游侠", "群像", "随园食单"],
        },
        message: {
          type: "string",
          example: "Valid chapters retrieved successfully",
        },
      },
    },
  })
  getValidChapters() {
    return {
      success: true,
      data: this.archivesService.getAllValidChapters(),
      message: "Valid chapters retrieved successfully",
    }
  }

  @Get("search-keywords")
  @ApiOperation({ summary: "获取搜索关键词列表" })
  @ApiResponse({
    status: 200,
    description: "返回搜索关键词列表",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 1 },
              keyword: { type: "string", example: "JavaScript" },
              searchCount: { type: "number", example: 5 },
              createdAt: {
                type: "string",
                example: "2025-07-07T02:30:00.000Z",
              },
              updatedAt: {
                type: "string",
                example: "2025-07-07T02:30:00.000Z",
              },
            },
          },
        },
        message: {
          type: "string",
          example: "Search keywords retrieved successfully",
        },
      },
    },
  })
  getSearchKeywords() {
    return this.archivesService.getSearchKeywords()
  }

  @Post("search-keywords")
  @ApiOperation({ summary: "记录搜索关键词" })
  @ApiBody({
    type: SearchKeywordDto,
    examples: {
      example1: {
        summary: "记录搜索关键词",
        value: {
          keyword: "JavaScript",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "搜索关键词记录成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            keyword: { type: "string", example: "JavaScript" },
            searchCount: { type: "number", example: 5 },
            createdAt: { type: "string", example: "2025-07-07T02:30:00.000Z" },
            updatedAt: { type: "string", example: "2025-07-07T02:30:00.000Z" },
          },
        },
        message: {
          type: "string",
          example: "Search keyword recorded successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Keyword cannot be empty",
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  recordSearchKeyword(@Body() searchKeywordDto: SearchKeywordDto) {
    return this.archivesService.recordSearchKeyword(searchKeywordDto.keyword)
  }

  @Get("pending-origs")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取待处理的邮件附件列表" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["pending", "archived"],
    description: "状态筛选，默认为 pending",
  })
  @ApiResponse({
    status: 200,
    description: "返回待处理的邮件附件列表",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 1 },
              senderEmail: { type: "string", example: "user@example.com" },
              messageId: {
                type: "string",
                example: "<message-id@example.com>",
              },
              subject: { type: "string", example: "邮件主题" },
              originalFilename: { type: "string", example: "document.pdf" },
              storageUrl: {
                type: "string",
                example: "aws_hash.pdf",
              },
              fileType: { type: "string", example: "pdf" },
              status: { type: "string", example: "pending" },
            },
          },
        },
        message: {
          type: "string",
          example: "Pending archive origs retrieved successfully",
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  getPendingOrigs(
    @Query() queryDto: QueryPendingOrigsDto,
    @CurrentUser() user: any,
  ) {
    return this.archivesService.findPendingOrigs(queryDto, user.id)
  }

  @Get("content/:storageUrl")
  @ApiOperation({
    summary: "获取归档内容（仅支持 S3）",
    description:
      "通过文件名获取 S3 存储的归档内容。注意：此接口仅适用于 S3 存储的文件，对于 OSS 存储或需要通过 ArchiveOrig 记录获取完整 URL。",
  })
  @ApiParam({
    name: "storageUrl",
    description: "S3 存储的归档文件名",
    example: "a.html",
  })
  @ApiResponse({
    status: 200,
    description: "返回归档内容",
    content: {
      "text/html": {
        schema: {
          type: "string",
          example:
            "<html><head><title>归档内容</title></head><body>...</body></html>",
        },
      },
      "application/json": {
        schema: {
          type: "string",
          example: '{"key": "value"}',
        },
      },
      "text/plain": {
        schema: {
          type: "string",
          example: "Plain text content",
        },
      },
      "application/pdf": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "文件不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Failed to fetch archive: File not found",
        },
      },
    },
  })
  async getArchiveContent(
    @Param("storageUrl") storageUrl: string,
    @Res() res: Response,
  ) {
    const result = (await this.archivesService.getArchiveContent(
      storageUrl,
    )) as {
      content: string | Buffer
      mimeType: string
      fileType: string
      size: number
      isTextFile: boolean
    }

    // 设置响应头
    res.setHeader("Content-Type", result.mimeType)
    res.setHeader("Content-Length", result.size)
    res.setHeader("Content-Disposition", `inline; filename="${storageUrl}"`)

    // 根据文件类型发送内容
    if (result.isTextFile) {
      res.send(result.content)
    } else {
      // 对于二进制文件，确保以 Buffer 形式发送
      res.end(result.content as Buffer)
    }
  }

  @Get(":id")
  @ApiOperation({ summary: "根据ID获取归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiQuery({
    name: "include",
    required: false,
    description:
      "可选包含的关联数据，设置为 'comments' 时会包含该归档的所有评论",
    example: "comments",
  })
  @ApiResponse({
    status: 200,
    description: "返回指定ID的归档",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 123 },
            title: { type: "string", example: "示例归档标题" },
            authors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
              },
              example: [
                { id: 1, name: "司马迁" },
                { id: 2, name: "裴駰" },
              ],
            },
            publisher: {
              type: "object",
              properties: { id: { type: "number" }, name: { type: "string" } },
              example: { id: 1, name: "出版社" },
            },
            date: {
              type: "object",
              properties: { id: { type: "number" }, value: { type: "string" } },
              example: { id: 1, value: "2025-06-16" },
            },
            chapter: { type: "string", example: "本纪" },
            tags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
              },
              example: [
                { id: 1, name: "标签1" },
                { id: 2, name: "标签2" },
              ],
            },
            remarks: { type: "string", example: "备注信息" },
            origs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  originalUrl: { type: "string", nullable: true },
                  storageUrl: { type: "string" },
                  fileType: { type: "string", nullable: true },
                  storageType: { type: "string" },
                },
              },
              example: [
                {
                  id: 1,
                  originalUrl: "https://example.com/original",
                  storageUrl: "file.html",
                  fileType: "html",
                  storageType: "s3",
                },
              ],
            },
            likes: { type: "number", example: 5 },
            commentsCount: {
              type: "number",
              example: 2,
              description: "仅在 include=comments 时返回",
            },
            comments: {
              type: "array",
              description: "仅在 include=comments 时返回",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", example: 1 },
                  nickname: { type: "string", example: "张三" },
                  content: { type: "string", example: "这是一个很好的归档！" },
                  archiveId: { type: "number", example: 123 },
                  createdAt: {
                    type: "string",
                    example: "2025-06-16T02:30:00.000Z",
                  },
                  updatedAt: {
                    type: "string",
                    example: "2025-06-16T02:30:00.000Z",
                  },
                },
              },
            },
          },
        },
        message: { type: "string", example: "Archive retrieved successfully" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "归档不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Archive with ID 123 not found" },
      },
    },
  })
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @Query("include") include?: string,
  ) {
    const includeComments = include === "comments"
    return this.archivesService.findOne(id, includeComments)
  }

  @Post(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "更新归档",
    description:
      "智能文件管理：通过files和originalUrls两个数组的组合，灵活处理文件的保持、替换、新增、删除操作。files数组可包含文件对象或storageUrl字符串，originalUrls数组指定URL抓取，前端按索引顺序传递，后端自动识别处理。",
  })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiBody({
    type: UpdateArchiveDto,
    description: "支持多文件上传的归档更新请求",
    examples: {
      "update-basic": {
        summary: "基本信息更新",
        description: "只更新文本字段，不涉及文件",
        value: {
          title: "更新后的标题",
          chapter: "世家",
          authors: ["更新作者1", "更新作者2"],
          publisher: "更新出版社",
          date: "2025-07-23",
          tags: ["更新标签1", "更新标签2"],
          remarks: "更新后的备注信息",
        },
      },
      "keep-and-update": {
        summary: "保持部分文件，更新其他文件",
        description:
          "通过files中的storageUrl字符串保持现有文件，新位置上传文件或抓取URL",
        value: {
          title: "智能文件管理示例1",
          chapter: "群像",
          authors: ["更新作者"],
          remarks: "保持第1、3个文件不变，更新第2个文件",
          // files数组中: 位置0和2为storageUrl字符串(保持现有)，位置1上传新文件
        },
      },
      "mixed-operations": {
        summary: "混合操作：保持、替换、新增、删除",
        description: "演示完整的文件管理能力",
        value: {
          title: "智能文件管理示例2",
          chapter: "列传",
          remarks:
            "保持第1个文件，从URL抓取第2个，上传第3个新文件，删除原第4个文件",
          // files数组: [storageUrl字符串, 新上传文件, 新上传文件]
          originalUrls: [
            "", // 位置0: 使用files中的storageUrl字符串
            "https://example.com/replacement.html", // 位置1: 从URL抓取
            "", // 位置2: 使用files中的上传文件
            // 位置3: 不传，删除原文件
          ],
        },
      },
      "pure-file-upload": {
        summary: "纯文件上传更新",
        description: "全部使用新上传文件，替换所有现有文件",
        value: {
          title: "纯文件上传示例",
          chapter: "世家",
          remarks: "使用files数组上传新文件，替换所有现有文件",
          originalUrls: [
            "", // 位置0: 使用files中的上传文件
            "https://example.com/web-content.html", // 位置1: 从URL抓取
            "", // 位置2: 使用files中的上传文件
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "归档更新成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            authors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
              },
            },
            publisher: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
              nullable: true,
            },
            date: {
              type: "object",
              properties: {
                id: { type: "number" },
                value: { type: "string" },
              },
              nullable: true,
            },
            chapter: { type: "string" },
            tags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
              },
            },
            remarks: { type: "string", nullable: true },
            origs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  originalUrl: { type: "string", nullable: true },
                  storageUrl: { type: "string" },
                  fileType: { type: "string", nullable: true },
                  storageType: { type: "string" },
                },
              },
            },
            likes: { type: "number" },
          },
        },
        message: { type: "string", example: "Archive updated successfully" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Invalid chapter. Must be one of: ...",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "归档不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Archive with ID 123 not found" },
      },
    },
  })
  @ApiConsumes("multipart/form-data")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
    }),
  )
  @UseInterceptors(FilesInterceptor("files", 10, multerConfig))
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateArchiveDto: UpdateArchiveDto,
    @CurrentUser() user: any,
    @Req() req: Request,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const userAgent =
      req.headers["user-agent"] || this.configService.fallbackUserAgent
    return this.archivesService.update(id, updateArchiveDto, userAgent, files)
  }

  @Delete(":id")
  @ApiOperation({ summary: "删除归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiResponse({
    status: 200,
    description: "归档删除成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Archive with ID 1 deleted successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "归档不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Archive with ID 123 not found" },
      },
    },
  })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.archivesService.remove(id)
  }

  @Post(":id/like")
  @ApiOperation({ summary: "点赞或取消点赞归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiBody({ type: LikeArchiveDto })
  @ApiResponse({
    status: 200,
    description: "操作成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            likes: { type: "number", example: 1 },
          },
        },
        message: {
          type: "string",
          example: "Liked successfully 或 Unliked successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Cannot unlike an archive with zero likes",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "归档不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Archive with ID 123 not found" },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  toggleLike(
    @Param("id", ParseIntPipe) id: number,
    @Body() likeArchiveDto: LikeArchiveDto,
  ) {
    return this.archivesService.toggleLike(id, likeArchiveDto.liked)
  }

  // 评论相关路由
  @Post(":id/comments")
  @ApiOperation({ summary: "为归档添加评论" })
  @ApiParam({ name: "id", description: "归档ID", example: 123 })
  @ApiBody({
    type: CreateCommentDto,
    examples: {
      example1: {
        summary: "基本评论示例",
        value: {
          nickname: "张三",
          content: "这是一个很好的归档！内容很有价值。",
        },
      },
      example2: {
        summary: "较长评论示例",
        value: {
          nickname: "技术爱好者",
          content:
            "感谢分享这个归档！这里面的内容对我的学习很有帮助。希望能看到更多类似的高质量内容。作者辛苦了！",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "评论创建成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            nickname: { type: "string", example: "张三" },
            content: {
              type: "string",
              example: "这是一个很好的归档！内容很有价值。",
            },
            archiveId: { type: "number", example: 123 },
            createdAt: { type: "string", example: "2025-06-16T02:30:00.000Z" },
            updatedAt: { type: "string", example: "2025-06-16T02:30:00.000Z" },
          },
        },
        message: { type: "string", example: "Comment created successfully" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Validation failed: nickname should not be empty",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "归档不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Archive with ID 123 not found" },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  createComment(
    @Param("id", ParseIntPipe) id: number,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.archivesService.createComment(id, createCommentDto)
  }

  @Get(":id/comments")
  @ApiOperation({ summary: "获取归档的所有评论" })
  @ApiParam({ name: "id", description: "归档ID", example: 123 })
  @ApiResponse({
    status: 200,
    description: "返回归档的所有评论",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 2 },
              nickname: { type: "string", example: "李四" },
              content: { type: "string", example: "非常有用的资料！" },
              archiveId: { type: "number", example: 123 },
              createdAt: {
                type: "string",
                example: "2025-06-16T02:35:00.000Z",
              },
              updatedAt: {
                type: "string",
                example: "2025-06-16T02:35:00.000Z",
              },
            },
          },
          example: [
            {
              id: 2,
              nickname: "李四",
              content: "非常有用的资料！",
              archiveId: 123,
              createdAt: "2025-06-16T02:35:00.000Z",
              updatedAt: "2025-06-16T02:35:00.000Z",
            },
            {
              id: 1,
              nickname: "张三",
              content: "这是一个很好的归档！",
              archiveId: 123,
              createdAt: "2025-06-16T02:30:00.000Z",
              updatedAt: "2025-06-16T02:30:00.000Z",
            },
          ],
        },
        message: { type: "string", example: "Comments retrieved successfully" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "归档不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Archive with ID 123 not found" },
      },
    },
  })
  getCommentsByArchive(@Param("id", ParseIntPipe) id: number) {
    return this.archivesService.getCommentsByArchive(id)
  }

  @Post(":id/comments/:commentId")
  @ApiOperation({ summary: "更新评论" })
  @ApiParam({ name: "id", description: "归档ID", example: 123 })
  @ApiParam({ name: "commentId", description: "评论ID", example: 1 })
  @ApiBody({
    type: UpdateCommentDto,
    examples: {
      updateNickname: {
        summary: "只更新昵称",
        value: {
          nickname: "新昵称",
        },
      },
      updateContent: {
        summary: "只更新内容",
        value: {
          content: "更新后的评论内容",
        },
      },
      updateBoth: {
        summary: "同时更新昵称和内容",
        value: {
          nickname: "修改后的昵称",
          content: "这是修改后的评论内容，更加详细和准确。",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "评论更新成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            nickname: { type: "string", example: "修改后的昵称" },
            content: {
              type: "string",
              example: "这是修改后的评论内容，更加详细和准确。",
            },
            archiveId: { type: "number", example: 123 },
            createdAt: { type: "string", example: "2025-06-16T02:30:00.000Z" },
            updatedAt: { type: "string", example: "2025-06-16T02:40:00.000Z" },
          },
        },
        message: { type: "string", example: "Comment updated successfully" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Validation failed: content is too long",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "评论不存在或不属于该归档",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Comment with ID 1 not found in archive 123",
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  updateComment(
    @Param("id", ParseIntPipe) archiveId: number,
    @Param("commentId", ParseIntPipe) commentId: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.archivesService.updateComment(
      commentId,
      updateCommentDto,
      archiveId,
    )
  }

  @Delete(":id/comments/:commentId")
  @ApiOperation({ summary: "删除评论" })
  @ApiParam({ name: "id", description: "归档ID", example: 123 })
  @ApiParam({ name: "commentId", description: "评论ID", example: 1 })
  @ApiResponse({
    status: 200,
    description: "评论删除成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: { type: "null", example: null },
        message: { type: "string", example: "Comment deleted successfully" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "评论不存在或不属于该归档",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: {
          type: "string",
          example: "Comment with ID 1 not found in archive 123",
        },
      },
    },
  })
  deleteComment(
    @Param("id", ParseIntPipe) archiveId: number,
    @Param("commentId", ParseIntPipe) commentId: number,
  ) {
    return this.archivesService.deleteComment(commentId, archiveId)
  }
}
