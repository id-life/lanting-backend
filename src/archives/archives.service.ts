import { Buffer } from "node:buffer"
import { extname } from "node:path"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { Cache } from "cache-manager"
import { execa } from "execa"
import { AwsService } from "@/common/aws/aws.service"
import { ConfigService } from "@/config/config.service"
import { PrismaService } from "../common/prisma/prisma.service"
import { getValidChapters, isValidChapter } from "./constants/archive-chapters"
import { CreateArchiveDto, ICreateArchive } from "./dto/create-archive.dto"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger(ArchivesService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 清除指定归档的所有相关缓存
   */
  private async clearArchiveCache(id: number): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`archives:v3:${id}`),
      this.cacheManager.del(`archives:v3:${id}:with-comments`),
      this.cacheManager.del("archives:v3:all"),
      this.cacheManager.del(`archive_comments:${id}`),
    ])
  }

  /**
   * 验证章节类别是否有效
   */
  private validateChapter(chapter?: string): void {
    if (chapter && !isValidChapter(chapter)) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: `Invalid chapter. Must be one of: ${getValidChapters().join(", ")}`,
      })
    }
  }

  /**
   * 获取所有有效的章节类别
   */
  getAllValidChapters(): string[] {
    return getValidChapters()
  }

  private handleError(error: any, operation: string) {
    const errorResponse = {
      success: false,
      data: null,
      message: error.message || `Failed to ${operation} archive`,
    }

    if (error instanceof NotFoundException) {
      throw new NotFoundException(errorResponse)
    }

    if (error instanceof BadRequestException) {
      throw new BadRequestException(errorResponse)
    }

    const ErrorClass =
      operation === "fetch" ? InternalServerErrorException : BadRequestException

    throw new ErrorClass({
      ...errorResponse,
      message: `Failed to ${operation} archive: ${error.message}`,
    })
  }

  async create(createArchiveDto: CreateArchiveDto, file?: Express.Multer.File) {
    // DTO 层已确保 chapter 不为空且为字符串，这里只需验证有效性
    this.validateChapter(createArchiveDto.chapter)

    const archive: ICreateArchive = {
      ...createArchiveDto,
    }

    try {
      let fileContent: Buffer
      if (!file && !archive.originalUrl) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: "Either a file or an original URL must be provided",
        })
      } else if (file) {
        // upload
        const fileExt = extname(file.originalname).toLowerCase()
        archive.fileType = fileExt.substring(1)
        fileContent = file.buffer
      } else if (archive.originalUrl) {
        // use single-file-cli
        try {
          const { stdout, stderr } = await execa(
            "single-file",
            [archive.originalUrl, "--dump-content"],
            {
              timeout: 120000,
              killSignal: "SIGTERM",
            },
          )

          if (stderr) {
            throw new Error(stderr)
          }

          archive.fileType = "html"
          fileContent = Buffer.from(stdout, "utf-8")
        } catch (error) {
          this.logger.error(
            `Failed to fetch content from ${archive.originalUrl}: ${error.message}`,
          )

          const simpleHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${archive.title}</title>
            <meta name="author" content="${archive.authors?.join(" ")}">
            <meta name="date" content="${archive.date}">
          </head>
          <body>
            <h1>${archive.title}</h1>
            <p>原始链接: <a href="${archive.originalUrl}">${archive.originalUrl}</a></p>
            <p>作者: ${archive.authors?.join(" ")}</p>
            <p>出版方: ${archive.publisher}</p>
            <p>日期: ${archive.date}</p>
            <p>备注: ${archive.remarks || ""}</p>
            <p>抓取失败，请访问原始链接查看内容。</p>
          </body>
          </html>
        `
          archive.fileType = "html"
          fileContent = Buffer.from(simpleHtml, "utf-8")
        }
      }

      // relative path, use this.awsService.getFileContent to get the file content
      const archivePath = await this.awsService.uploadPublicFile(
        this.configService.awsS3Directory,
        `${createArchiveDto.title}${Date.now()}${archive.fileType ? `.${archive.fileType}` : ""}`,
        fileContent!,
      )
      archive.archiveFilename = archivePath.replace(
        `${this.configService.awsS3Directory}/`,
        "",
      )

      // 使用事务创建档案和作者关系
      const archiveRes = await this.prismaService.$transaction(
        async (prisma) => {
          // 创建档案
          const newArchive = await prisma.archive.create({
            data: {
              title: archive.title,
              publisher: archive.publisher,
              date: archive.date,
              chapter: archive.chapter,
              tag: archive.tag,
              remarks: archive.remarks,
              originalUrl: archive.originalUrl,
              archiveFilename: archive.archiveFilename,
              fileType: archive.fileType,
            },
          })

          // 处理作者关系
          if (createArchiveDto.authors && createArchiveDto.authors.length > 0) {
            for (let i = 0; i < createArchiveDto.authors.length; i++) {
              const authorName = createArchiveDto.authors[i].trim()
              if (authorName) {
                // 查找或创建作者
                const author = await prisma.author.upsert({
                  where: { name: authorName },
                  create: { name: authorName },
                  update: {},
                })

                // 创建档案-作者关系
                await prisma.archiveAuthor.create({
                  data: {
                    archiveId: newArchive.id,
                    authorId: author.id,
                    order: i + 1,
                  },
                })
              }
            }
          }

          // 返回包含作者信息的档案
          return prisma.archive.findUnique({
            where: { id: newArchive.id },
            include: {
              authors: {
                include: { author: true },
                orderBy: { order: "asc" },
              },
            },
          })
        },
      )

      // 清除归档列表缓存
      await this.cacheManager.del("archives:v3:all")

      return {
        success: true,
        data: archiveRes,
      }
    } catch (error) {
      this.handleError(error, "create")
    }
  }

  async findAll() {
    const cacheKey = "archives:v3:all" // 更新缓存版本

    try {
      // 先尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 缓存未命中，从数据库查询
      const archives = await this.prismaService.archive.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          authors: {
            include: { author: true },
            orderBy: { order: "asc" },
          },
        },
      })

      const result = {
        success: true,
        count: archives.length,
        data: archives,
      }

      // 缓存结果，缓存5分钟
      await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000)

      return result
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  async findOne(id: number, includeComments: boolean = false) {
    const cacheKey = includeComments
      ? `archives:v3:${id}:with-comments`
      : `archives:v3:${id}` // 更新缓存版本

    try {
      // 先尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 缓存未命中，从数据库查询
      const archive = await this.prismaService.archive.findUnique({
        where: { id },
        include: {
          authors: {
            include: { author: true },
            orderBy: { order: "asc" },
          },
          comments: includeComments
            ? {
                orderBy: { createdAt: "desc" },
              }
            : false,
        },
      })

      if (!archive) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Archive with ID ${id} not found`,
        })
      }

      const result = {
        success: true,
        data: includeComments
          ? {
              ...archive,
              commentsCount: archive.comments?.length || 0,
            }
          : archive,
      }

      // 缓存结果，包含评论的缓存时间短一些
      const cacheTime = includeComments ? 5 * 60 * 1000 : 10 * 60 * 1000
      await this.cacheManager.set(cacheKey, result, cacheTime)

      return result
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  async update(id: number, updateArchiveDto: UpdateArchiveDto) {
    try {
      // 验证章节类别（更新时可选但如果提供必须有效）
      this.validateChapter(updateArchiveDto.chapter)

      await this.findOne(id, false)

      // 使用事务更新档案和作者关系
      const archive = await this.prismaService.$transaction(async (prisma) => {
        // 更新档案基本信息
        await prisma.archive.update({
          where: { id },
          data: {
            title: updateArchiveDto.title,
            publisher: updateArchiveDto.publisher,
            date: updateArchiveDto.date,
            chapter: updateArchiveDto.chapter,
            tag: updateArchiveDto.tag,
            remarks: updateArchiveDto.remarks,
            originalUrl: updateArchiveDto.originalUrl,
          },
        })

        // 处理作者关系更新
        if (updateArchiveDto.authors !== undefined) {
          // 删除现有的作者关系
          await prisma.archiveAuthor.deleteMany({
            where: { archiveId: id },
          })

          // 创建新的作者关系
          if (updateArchiveDto.authors && updateArchiveDto.authors.length > 0) {
            for (let i = 0; i < updateArchiveDto.authors.length; i++) {
              const authorName = updateArchiveDto.authors[i].trim()
              if (authorName) {
                // 查找或创建作者
                const author = await prisma.author.upsert({
                  where: { name: authorName },
                  create: { name: authorName },
                  update: {},
                })

                // 创建档案-作者关系
                await prisma.archiveAuthor.create({
                  data: {
                    archiveId: id,
                    authorId: author.id,
                    order: i + 1,
                  },
                })
              }
            }
          }
        }

        // 返回包含作者信息的档案
        return prisma.archive.findUnique({
          where: { id },
          include: {
            authors: {
              include: { author: true },
              orderBy: { order: "asc" },
            },
          },
        })
      })

      // 清除相关缓存
      await this.clearArchiveCache(id)

      return {
        success: true,
        data: archive,
      }
    } catch (error) {
      this.handleError(error, "update")
    }
  }

  async remove(id: number) {
    try {
      const archiveResult = await this.findOne(id, false)
      const archive = (archiveResult as any)?.data

      await this.prismaService.archive.delete({
        where: { id },
      })

      // 清除相关缓存
      await this.clearArchiveCache(id)

      // 如果有归档文件名，也清除文件内容缓存
      if (archive?.archiveFilename) {
        await this.cacheManager.del(
          `archive_content:${archive.archiveFilename}`,
        )
      }

      return {
        success: true,
        message: `Archive with ID ${id} deleted successfully`,
      }
    } catch (error) {
      this.handleError(error, "delete")
    }
  }

  async toggleLike(id: number, liked: boolean) {
    try {
      // 验证归档是否存在
      const archiveResult = await this.findOne(id, false)
      const currentArchive = (archiveResult as any)?.data

      if (!currentArchive) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Archive with ID ${id} not found`,
        })
      }

      let archive
      let message

      if (liked) {
        // 点赞操作
        archive = await this.prismaService.archive.update({
          where: { id },
          data: {
            likes: { increment: 1 },
          },
          select: { id: true, likes: true },
        })
        message = "Liked successfully"
      } else {
        // 取消点赞操作
        // 确保点赞数不会变成负数
        if (currentArchive.likes <= 0) {
          throw new BadRequestException({
            success: false,
            data: null,
            message: "Cannot unlike an archive with zero likes",
          })
        }

        archive = await this.prismaService.archive.update({
          where: { id },
          data: {
            likes: { decrement: 1 },
          },
          select: { id: true, likes: true },
        })
        message = "Unliked successfully"
      }

      // 清除相关缓存
      await this.clearArchiveCache(id)

      return {
        success: true,
        data: archive,
        message,
      }
    } catch (error) {
      this.handleError(error, liked ? "like" : "unlike")
    }
  }

  async getArchiveContent(archiveFilename: string) {
    const cacheKey = `archive_content:${archiveFilename}`

    try {
      // 先尝试从缓存获取
      const cachedContent = await this.cacheManager.get(cacheKey)
      if (cachedContent) {
        return cachedContent
      }

      // 缓存未命中，从S3获取文件内容
      const content = await this.awsService.getFileContent(
        `${this.configService.awsS3Directory}/${archiveFilename}`,
      )

      const result = content.toString("utf-8")

      // 缓存结果，文件内容缓存30分钟（文件内容不经常变化）
      await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000)

      return result
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  // 评论相关方法
  async createComment(archiveId: number, createCommentDto: CreateCommentDto) {
    try {
      // 验证归档是否存在
      await this.findOne(archiveId, false)

      const comment = await this.prismaService.comment.create({
        data: {
          ...createCommentDto,
          archiveId,
        },
      })

      // 清除相关缓存
      await this.clearArchiveCache(archiveId)

      return {
        success: true,
        data: comment,
        message: "Comment created successfully",
      }
    } catch (error) {
      this.handleError(error, "create comment")
    }
  }

  async getCommentsByArchive(archiveId: number) {
    const cacheKey = `archive_comments:${archiveId}`

    try {
      // 验证归档是否存在
      await this.findOne(archiveId, false)

      // 先尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 缓存未命中，从数据库查询
      const comments = await this.prismaService.comment.findMany({
        where: { archiveId },
        orderBy: { createdAt: "desc" },
      })

      const result = {
        success: true,
        count: comments.length,
        data: comments,
      }

      // 缓存结果，缓存3分钟
      await this.cacheManager.set(cacheKey, result, 3 * 60 * 1000)

      return result
    } catch (error) {
      this.handleError(error, "fetch comments")
    }
  }

  async updateComment(
    commentId: number,
    updateCommentDto: UpdateCommentDto,
    archiveId?: number,
  ) {
    try {
      const comment = await this.prismaService.comment.update({
        where: { id: commentId },
        data: updateCommentDto,
      })

      // 清除相关缓存
      if (archiveId) {
        await this.clearArchiveCache(archiveId)
      } else {
        await this.clearArchiveCache(comment.archiveId)
      }

      return {
        success: true,
        data: comment,
        message: "Comment updated successfully",
      }
    } catch (error) {
      this.handleError(error, "update comment")
    }
  }

  async deleteComment(commentId: number, archiveId?: number) {
    try {
      const comment = await this.prismaService.comment.delete({
        where: { id: commentId },
      })

      // 清除相关缓存
      if (archiveId) {
        await this.clearArchiveCache(archiveId)
      } else {
        await this.clearArchiveCache(comment.archiveId)
      }

      return {
        success: true,
        message: "Comment deleted successfully",
      }
    } catch (error) {
      this.handleError(error, "delete comment")
    }
  }
}
