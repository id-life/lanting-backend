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
import { lookup } from "mime-types"
import { AwsService } from "@/common/aws/aws.service"
import { ConfigService } from "@/config/config.service"
import { PrismaService } from "../common/prisma/prisma.service"
import { getValidChapters, isValidChapter } from "./constants/archive-chapters"
import { CreateArchiveDto, ICreateArchive } from "./dto/create-archive.dto"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"
import { ArchiveWithRelations } from "./types"

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

  async create(
    createArchiveDto: CreateArchiveDto,
    userAgent: string,
    file?: Express.Multer.File,
  ) {
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
            [
              archive.originalUrl,
              "--dump-content",
              `--user-agent=${userAgent}`,
            ],
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
      const storageFilename = archivePath.replace(
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
              chapter: archive.chapter,
              remarks: archive.remarks,
            },
          })

          // 创建档案原始文件记录
          await prisma.archiveOrig.create({
            data: {
              archiveId: newArchive.id,
              originalUrl: archive.originalUrl,
              storageUrl: storageFilename,
              fileType: archive.fileType,
              storageType: "s3",
            },
          })

          // 处理标签关系
          if (createArchiveDto.tags && createArchiveDto.tags.length > 0) {
            for (const tagName of createArchiveDto.tags) {
              const trimmedTagName = tagName.trim()
              if (trimmedTagName) {
                // 查找或创建标签
                const tag = await prisma.tag.upsert({
                  where: { name: trimmedTagName },
                  create: { name: trimmedTagName },
                  update: {},
                })

                // 创建档案-标签关系
                await prisma.archiveTag.create({
                  data: {
                    archiveId: newArchive.id,
                    tagId: tag.id,
                  },
                })
              }
            }
          }

          // 处理日期关系
          if (createArchiveDto.date && createArchiveDto.date.trim()) {
            const dateValue = createArchiveDto.date.trim()

            // 查找或创建日期
            const date = await prisma.date.upsert({
              where: { value: dateValue },
              create: { value: dateValue },
              update: {},
            })

            // 创建档案-日期关系
            await prisma.archiveDate.create({
              data: {
                archiveId: newArchive.id,
                dateId: date.id,
              },
            })
          }

          // 处理出版方关系
          if (createArchiveDto.publisher && createArchiveDto.publisher.trim()) {
            const publisherName = createArchiveDto.publisher.trim()

            // 查找或创建出版方
            const publisher = await prisma.publisher.upsert({
              where: { name: publisherName },
              create: { name: publisherName },
              update: {},
            })

            // 创建档案-出版方关系
            await prisma.archivePublisher.create({
              data: {
                archiveId: newArchive.id,
                publisherId: publisher.id,
              },
            })
          }

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

          // 返回包含作者、出版方、日期、标签和原始文件信息的档案
          return prisma.archive.findUnique({
            where: { id: newArchive.id },
            include: {
              authors: {
                include: { author: true },
                orderBy: { order: "asc" },
              },
              publisher: {
                include: { publisher: true },
              },
              date: {
                include: { date: true },
              },
              tags: {
                include: { tag: true },
              },
              origs: true,
            },
          })
        },
      )

      // 清除归档列表缓存
      await this.cacheManager.del("archives:v3:all")

      return {
        success: true,
        data: this.transformArchiveData(archiveRes),
        message: "Archive created successfully",
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
          publisher: {
            include: { publisher: true },
          },
          date: {
            include: { date: true },
          },
          tags: {
            include: { tag: true },
          },
          origs: true,
        },
      })

      const result = {
        success: true,
        data: archives.map((archive) => this.transformArchiveData(archive)),
        message: "Archives retrieved successfully",
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
          publisher: {
            include: { publisher: true },
          },
          date: {
            include: { date: true },
          },
          tags: {
            include: { tag: true },
          },
          origs: true,
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

      const transformedArchive = this.transformArchiveData(archive)

      const result = {
        success: true,
        data: includeComments
          ? {
              ...transformedArchive,
              commentsCount: archive.comments?.length || 0,
              comments: archive.comments,
            }
          : transformedArchive,
        message: "Archive retrieved successfully",
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
            chapter: updateArchiveDto.chapter,
            remarks: updateArchiveDto.remarks,
          },
        })

        // 处理标签关系更新
        if (updateArchiveDto.tags !== undefined) {
          // 先删除现有的标签关系
          await prisma.archiveTag.deleteMany({
            where: { archiveId: id },
          })

          // 如果提供了新的标签，创建新的关系
          if (updateArchiveDto.tags && updateArchiveDto.tags.length > 0) {
            for (const tagName of updateArchiveDto.tags) {
              const trimmedTagName = tagName.trim()
              if (trimmedTagName) {
                // 查找或创建标签
                const tag = await prisma.tag.upsert({
                  where: { name: trimmedTagName },
                  create: { name: trimmedTagName },
                  update: {},
                })

                // 创建档案-标签关系
                await prisma.archiveTag.create({
                  data: {
                    archiveId: id,
                    tagId: tag.id,
                  },
                })
              }
            }
          }
        }

        // 处理日期关系更新
        if (updateArchiveDto.date !== undefined) {
          // 先删除现有的日期关系
          await prisma.archiveDate.deleteMany({
            where: { archiveId: id },
          })

          // 如果提供了新的日期，创建新的关系
          if (updateArchiveDto.date && updateArchiveDto.date.trim()) {
            const dateValue = updateArchiveDto.date.trim()

            // 查找或创建日期
            const date = await prisma.date.upsert({
              where: { value: dateValue },
              create: { value: dateValue },
              update: {},
            })

            // 创建档案-日期关系
            await prisma.archiveDate.create({
              data: {
                archiveId: id,
                dateId: date.id,
              },
            })
          }
        }

        // 处理出版方关系更新
        if (updateArchiveDto.publisher !== undefined) {
          // 先删除现有的出版方关系
          await prisma.archivePublisher.deleteMany({
            where: { archiveId: id },
          })

          // 如果提供了新的出版方，创建新的关系
          if (updateArchiveDto.publisher && updateArchiveDto.publisher.trim()) {
            const publisherName = updateArchiveDto.publisher.trim()

            // 查找或创建出版方
            const publisher = await prisma.publisher.upsert({
              where: { name: publisherName },
              create: { name: publisherName },
              update: {},
            })

            // 创建档案-出版方关系
            await prisma.archivePublisher.create({
              data: {
                archiveId: id,
                publisherId: publisher.id,
              },
            })
          }
        }

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

        // 返回包含作者、出版方、日期、标签和原始文件信息的档案
        return prisma.archive.findUnique({
          where: { id },
          include: {
            authors: {
              include: { author: true },
              orderBy: { order: "asc" },
            },
            publisher: {
              include: { publisher: true },
            },
            date: {
              include: { date: true },
            },
            tags: {
              include: { tag: true },
            },
            origs: true,
          },
        })
      })

      // 清除相关缓存
      await this.clearArchiveCache(id)

      return {
        success: true,
        data: this.transformArchiveData(archive),
        message: "Archive updated successfully",
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

      // 清除所有相关文件内容缓存
      if (archive?.origs && archive.origs.length > 0) {
        const cachePromises = archive.origs.map((orig: any) =>
          this.cacheManager.del(`archive_content:${orig.id}`),
        )
        await Promise.all(cachePromises)
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

  /**
   * 获取归档内容（仅支持 S3 存储的文件）
   *
   * 注意：此方法仅适用于从 S3 获取存储的文件内容，
   * 通过文件名直接访问 S3 中的文件。
   *
   * 对于 OSS 存储或需要通过 ArchiveOrig 记录获取内容的 URL，
   *
   * @param archiveFilename - S3 存储的文件名
   * @returns 包含文件内容、MIME类型和文件类型的对象
   */
  async getArchiveContent(archiveFilename: string) {
    const cacheKey = `archive_content:${archiveFilename}`

    try {
      // 先尝试从缓存获取
      const cachedContent = await this.cacheManager.get(cacheKey)
      if (cachedContent) {
        const cached = cachedContent as any
        // 如果是二进制文件的缓存，需要重新创建Buffer
        if (cached.isTextFile === false && typeof cached.content === "string") {
          cached.content = Buffer.from(cached.content, "base64")
        }
        return cached
      }

      // 缓存未命中，从S3获取文件内容
      // 注意：此处仅支持 S3 存储，storageType 为 's3' 的文件
      const content = await this.awsService.getFileContent(
        `${this.configService.awsS3Directory}/${archiveFilename}`,
      )

      // 从文件名提取文件扩展名
      const fileExtension = extname(archiveFilename).toLowerCase().substring(1)

      // 使用 mime-types 库获取 MIME 类型
      const mimeType = lookup(archiveFilename) || "application/octet-stream"

      // 判断是否为文本文件，只有文本文件才转换为字符串
      const isTextFile =
        mimeType.startsWith("text/") ||
        mimeType === "application/json" ||
        mimeType === "application/xml" ||
        mimeType === "application/javascript" ||
        mimeType === "application/typescript" ||
        mimeType.includes("xml") || // 添加其他XML类型
        mimeType === "application/x-javascript" ||
        mimeType === "application/ecmascript"

      const result = {
        content: isTextFile ? content.toString("utf-8") : content,
        mimeType,
        fileType: fileExtension,
        size: content.length,
        isTextFile,
      }

      // 缓存结果，对于二进制文件，将Buffer转换为base64字符串以便缓存
      const cacheData = {
        ...result,
        content: isTextFile ? result.content : content.toString("base64"),
      }

      // 缓存结果，文件内容缓存30分钟（文件内容不经常变化）
      await this.cacheManager.set(cacheKey, cacheData, 30 * 60 * 1000)

      return result
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  /**
   * 转换数据库查询结果为API响应格式
   */
  private transformArchiveData(archive: ArchiveWithRelations | null) {
    if (!archive) {
      return null
    }

    // 解构排除 createdAt 和 updatedAt
    const { createdAt, updatedAt, ...archiveWithoutTimestamps } = archive

    return {
      ...archiveWithoutTimestamps,
      authors:
        archive.authors
          ?.sort((a, b) => a.order - b.order)
          ?.map((archiveAuthor) => ({
            id: archiveAuthor.author.id,
            name: archiveAuthor.author.name,
          })) || [],
      publisher: archive.publisher?.publisher
        ? {
            id: archive.publisher.publisher.id,
            name: archive.publisher.publisher.name,
          }
        : null,
      date: archive.date?.date
        ? {
            id: archive.date.date.id,
            value: archive.date.date.value,
          }
        : null,
      tags:
        archive.tags?.map((archiveTag) => ({
          id: archiveTag.tag.id,
          name: archiveTag.tag.name,
        })) || [],
      origs:
        archive.origs?.map((orig) => ({
          id: orig.id,
          originalUrl: orig.originalUrl,
          storageUrl: orig.storageUrl,
          fileType: orig.fileType,
          storageType: orig.storageType,
        })) || [],
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
        data: comments,
        message: "Comments retrieved successfully",
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
      // 先验证评论是否存在
      const existingComment = await this.prismaService.comment.findUnique({
        where: { id: commentId },
        include: { archive: true },
      })

      if (!existingComment) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Comment with ID ${commentId} not found`,
        })
      }

      // 如果提供了 archiveId，验证评论是否属于该归档
      if (archiveId && existingComment.archiveId !== archiveId) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Comment with ID ${commentId} not found in archive ${archiveId}`,
        })
      }

      const comment = await this.prismaService.comment.update({
        where: { id: commentId },
        data: updateCommentDto,
      })

      // 清除相关缓存
      await this.clearArchiveCache(comment.archiveId)

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
      // 先验证评论是否存在
      const existingComment = await this.prismaService.comment.findUnique({
        where: { id: commentId },
        include: { archive: true },
      })

      if (!existingComment) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Comment with ID ${commentId} not found`,
        })
      }

      // 如果提供了 archiveId，验证评论是否属于该归档
      if (archiveId && existingComment.archiveId !== archiveId) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Comment with ID ${commentId} not found in archive ${archiveId}`,
        })
      }

      const comment = await this.prismaService.comment.delete({
        where: { id: commentId },
      })

      // 清除相关缓存
      await this.clearArchiveCache(comment.archiveId)

      return {
        success: true,
        data: null,
        message: "Comment deleted successfully",
      }
    } catch (error) {
      this.handleError(error, "delete comment")
    }
  }

  // 搜索关键词相关方法
  async recordSearchKeyword(keyword: string) {
    try {
      const trimmedKeyword = keyword.trim()
      if (!trimmedKeyword) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: "Keyword cannot be empty",
        })
      }

      // 使用 upsert 操作，如果关键词存在则增加计数，否则创建新记录
      const searchKeyword = await this.prismaService.searchKeyword.upsert({
        where: { keyword: trimmedKeyword },
        update: {
          searchCount: { increment: 1 },
        },
        create: {
          keyword: trimmedKeyword,
          searchCount: 1,
        },
        select: {
          id: true,
          keyword: true,
          searchCount: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      // 清除搜索关键词缓存，因为数据已发生变化
      await this.cacheManager.del("search_keywords:all")

      return {
        success: true,
        data: searchKeyword,
        message: "Search keyword recorded successfully",
      }
    } catch (error) {
      this.handleError(error, "record search keyword")
    }
  }

  async getSearchKeywords() {
    const cacheKey = "search_keywords:all"

    try {
      // 尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 获取所有搜索关键词，按 count 降序，然后按创建时间降序
      const keywords = await this.prismaService.searchKeyword.findMany({
        select: {
          id: true,
          keyword: true,
          searchCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ searchCount: "desc" }, { createdAt: "desc" }],
      })

      const result = {
        success: true,
        data: keywords,
        message: "Search keywords retrieved successfully",
      }

      // 缓存结果 5 分钟
      await this.cacheManager.set(cacheKey, result, 300000)

      return result
    } catch (error) {
      this.handleError(error, "get search keywords")
    }
  }
}
