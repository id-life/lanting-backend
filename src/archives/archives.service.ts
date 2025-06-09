import { Buffer } from "node:buffer"
import { extname } from "node:path"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { Cache } from "cache-manager"
import { execa } from "execa"
import { AwsService } from "@/common/aws/aws.service"
import { ConfigService } from "@/config/config.service"
import { PrismaService } from "../common/prisma/prisma.service"
import { getValidChapters, isValidChapter } from "./constants/archive-chapters"
import { CreateArchiveDto, ICreateArchive } from "./dto/create-archive.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"

@Injectable()
export class ArchivesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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
          const { stdout, stderr } = await execa("single-file", [
            archive.originalUrl,
            "--dump-content",
          ])

          if (stderr) {
            throw new BadRequestException({
              success: false,
              data: null,
              message: `Failed to fetch content from original URL: ${stderr}`,
            })
          }

          archive.fileType = "html"
          fileContent = Buffer.from(stdout, "utf-8")
        } catch {
          const simpleHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${archive.title}</title>
            <meta name="author" content="${archive.author}">
            <meta name="date" content="${archive.date}">
          </head>
          <body>
            <h1>${archive.title}</h1>
            <p>原始链接: <a href="${archive.originalUrl}">${archive.originalUrl}</a></p>
            <p>作者: ${archive.author}</p>
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

      const archiveRes = await this.prismaService.archive.create({
        data: archive,
      })

      // 清除归档列表缓存
      await this.cacheManager.del("archives:all")

      return {
        success: true,
        data: archiveRes,
      }
    } catch (error) {
      this.handleError(error, "create")
    }
  }

  async findAll() {
    const cacheKey = "archives:all"

    try {
      // 先尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 缓存未命中，从数据库查询
      const archives = await this.prismaService.archive.findMany({
        orderBy: { createdAt: "desc" },
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

  async findOne(id: number) {
    const cacheKey = `archives:${id}`

    try {
      // 先尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 缓存未命中，从数据库查询
      const archive = await this.prismaService.archive.findUnique({
        where: { id },
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
        data: archive,
      }

      // 缓存结果，缓存10分钟（单个资源缓存时间长一些）
      await this.cacheManager.set(cacheKey, result, 10 * 60 * 1000)

      return result
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  async update(id: number, updateArchiveDto: UpdateArchiveDto) {
    try {
      // 验证章节类别（更新时可选但如果提供必须有效）
      this.validateChapter(updateArchiveDto.chapter)

      await this.findOne(id)

      const archive = await this.prismaService.archive.update({
        where: { id },
        data: updateArchiveDto,
      })

      // 清除相关缓存
      await this.cacheManager.del(`archives:${id}`)
      await this.cacheManager.del("archives:all")

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
      const archiveResult = await this.findOne(id)
      const archive = (archiveResult as any)?.data

      await this.prismaService.archive.delete({
        where: { id },
      })

      // 清除相关缓存
      await this.cacheManager.del(`archives:${id}`)
      await this.cacheManager.del("archives:all")

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
}
