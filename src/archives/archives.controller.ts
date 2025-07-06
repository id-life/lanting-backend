import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { multerConfig } from "@/config/configuration/multer.config"
import { ArchivesService } from "./archives.service"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { ArchiveFileUploadDto } from "./dto/file-upload.dts"
import { LikeArchiveDto } from "./dto/like-archive.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"
import { Archive } from "./entities/archive.entity"

@ApiTags("archives")
@Controller("archives")
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  @Post()
  @ApiOperation({ summary: "创建新归档" })
  @ApiResponse({ status: 201, description: "归档创建成功", type: Archive })
  @ApiBody({ type: ArchiveFileUploadDto })
  @ApiConsumes("multipart/form-data")
  @UsePipes(new ValidationPipe({ transform: true }))
  @UseInterceptors(FileInterceptor("file", multerConfig))
  create(
    @Body() createArchiveDto: CreateArchiveDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.archivesService.create(createArchiveDto, file)
  }

  @Get()
  @ApiOperation({ summary: "获取所有归档" })
  @ApiResponse({ status: 200, description: "返回所有归档", type: [Archive] })
  findAll() {
    return this.archivesService.findAll()
  }

  @Get("chapters")
  @ApiOperation({ summary: "获取所有有效的章节类别" })
  @ApiResponse({
    status: 200,
    description: "返回所有有效的章节类别",
    schema: {
      type: "array",
      items: { type: "string" },
      example: ["本纪", "世家", "搜神", "列传", "游侠", "群像", "随园食单"],
    },
  })
  getValidChapters() {
    return {
      success: true,
      data: this.archivesService.getAllValidChapters(),
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
                  order: { type: "number" },
                },
              },
              example: [
                { id: 1, name: "司马迁", order: 1 },
                { id: 2, name: "裴駰", order: 2 },
              ],
            },
            publisher: { type: "string", example: "出版社" },
            date: { type: "string", example: "2025-06-16" },
            chapter: { type: "string", example: "本纪" },
            tag: { type: "object", example: ["标签1", "标签2"] },
            remarks: { type: "string", example: "备注信息" },
            originalUrl: { type: "string", example: "https://example.com" },
            archiveFilename: { type: "string", example: "archive_123.html" },
            fileType: { type: "string", example: "html" },
            likes: { type: "number", example: 5 },
            createdAt: { type: "string", example: "2025-06-16T02:00:00.000Z" },
            updatedAt: { type: "string", example: "2025-06-16T02:00:00.000Z" },
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
  @ApiOperation({ summary: "更新归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiResponse({ status: 200, description: "归档更新成功", type: Archive })
  @UsePipes(new ValidationPipe({ transform: true }))
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateArchiveDto: UpdateArchiveDto,
  ) {
    return this.archivesService.update(id, updateArchiveDto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "删除归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiResponse({ status: 200, description: "归档删除成功" })
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
        message: { type: "string", example: "Liked successfully" },
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

  @Get("content/:archiveFilename")
  @ApiOperation({ summary: "获取归档内容" })
  @ApiParam({ name: "archiveFilename", description: "归档文件名" })
  @ApiResponse({ status: 200, description: "返回归档内容" })
  getArchiveContent(@Param("archiveFilename") archiveFilename: string) {
    return this.archivesService.getArchiveContent(archiveFilename)
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
        count: { type: "number", example: 2 },
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

  @Post("comments/:commentId")
  @ApiOperation({ summary: "更新评论" })
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
    description: "评论不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Comment with ID 1 not found" },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  updateComment(
    @Param("commentId", ParseIntPipe) commentId: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.archivesService.updateComment(commentId, updateCommentDto)
  }

  @Delete("comments/:commentId")
  @ApiOperation({ summary: "删除评论" })
  @ApiParam({ name: "commentId", description: "评论ID", example: 1 })
  @ApiResponse({
    status: 200,
    description: "评论删除成功",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Comment deleted successfully" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "评论不存在",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null", example: null },
        message: { type: "string", example: "Comment with ID 1 not found" },
      },
    },
  })
  deleteComment(@Param("commentId", ParseIntPipe) commentId: number) {
    return this.archivesService.deleteComment(commentId)
  }
}
