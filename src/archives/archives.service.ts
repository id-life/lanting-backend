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
import {
  CreateArchiveDto,
  FileProcessingItem,
  ICreateArchive,
} from "./dto/create-archive.dto"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { QueryPendingOrigsDto } from "./dto/query-pending-origs.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"
import { ArchiveWithRelations } from "./types"

interface FileOperationResult {
  position: number
  action: "create" | "delete" | "keep"
  data?: {
    originalUrl?: string
    storageUrl: string
    fileType?: string
    storageType: string
  }
  existingFileId?: number
}

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

  /**
   * 处理文件和URL的混合模式，生成文件处理项目数组
   */
  private prepareFileProcessingItems(
    files?: Express.Multer.File[],
    originalUrls?: string[],
  ): FileProcessingItem[] {
    const fileProcessingItems: FileProcessingItem[] = []

    // 计算最大长度，支持混合模式
    const maxLength = Math.max(files?.length || 0, originalUrls?.length || 0)

    // 统一处理所有位置的文件/URL，支持混合模式
    for (let index = 0; index < maxLength; index++) {
      const file = files?.[index]
      const originalUrl = originalUrls?.[index]

      // 跳过完全空的位置（既没有文件也没有URL）
      if (!file && (!originalUrl || !originalUrl.trim())) {
        continue
      }

      fileProcessingItems.push({
        file: file || undefined,
        originalUrl:
          originalUrl && originalUrl.trim() ? originalUrl.trim() : undefined,
        fileIndex: index,
      })
    }

    return fileProcessingItems
  }

  /**
   * 生成URL抓取失败时的备用HTML内容
   */
  private generateFallbackHtml(
    title: string,
    authors?: string[],
    date?: string,
    publisher?: string,
    chapter?: string,
    tags?: string[],
    remarks?: string,
    originalUrl?: string,
  ): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <meta name="authors" content="${authors?.join(" ") || ""}">
      <meta name="date" content="${date || ""}">
      <meta name="publisher" content="${publisher || ""}">
      <meta name="chapter" content="${chapter || ""}">
      <meta name="tags" content="${tags?.join(", ") || ""}">
      <meta name="remarks" content="${remarks || ""}">
    </head>
    <body>
      <h1>${title}</h1>
      <p>原始链接: <a href="${originalUrl}">${originalUrl}</a></p>
      <p>作者: ${authors?.join(" ") || ""}</p>
      <p>出版方: ${publisher || ""}</p>
      <p>日期: ${date || ""}</p>
      <p>备注: ${remarks || ""}</p>
      <p>抓取失败，请访问原始链接查看内容。</p>
    </body>
    </html>
    `
  }

  /**
   * 从URL抓取内容，失败时返回备用HTML
   */
  private async fetchUrlContent(
    url: string,
    userAgent: string,
    title: string,
    authors?: string[],
    date?: string,
    publisher?: string,
    chapter?: string,
    tags?: string[],
    remarks?: string,
  ): Promise<{ content: Buffer; fileType: string }> {
    try {
      const { stdout, stderr } = await execa(
        "single-file",
        [url, "--dump-content", `--user-agent=${userAgent}`],
        {
          timeout: 120000,
          killSignal: "SIGTERM",
        },
      )

      if (stderr) {
        throw new Error(stderr)
      }

      return {
        content: Buffer.from(stdout, "utf-8"),
        fileType: "html",
      }
    } catch (error) {
      this.logger.error(`Failed to fetch content from ${url}: ${error.message}`)

      const fallbackHtml = this.generateFallbackHtml(
        title,
        authors,
        date,
        publisher,
        chapter,
        tags,
        remarks,
        url,
      )

      return {
        content: Buffer.from(fallbackHtml, "utf-8"),
        fileType: "html",
      }
    }
  }

  /**
   * 上传文件到S3并返回存储文件名
   */
  private async uploadFileToS3(
    filename: string,
    content: Buffer,
  ): Promise<string> {
    const archivePath = await this.awsService.uploadPublicFile(
      this.configService.awsS3Directory,
      filename,
      content,
    )
    return archivePath.replace(`${this.configService.awsS3Directory}/`, "")
  }

  /**
   * 处理文件处理项目数组，生成处理后的文件数组
   */
  private async processFileItems(
    fileProcessingItems: FileProcessingItem[],
    titlePrefix: string,
    userAgent: string,
    authors?: string[],
    date?: string,
    publisher?: string,
    chapter?: string,
    tags?: string[],
    remarks?: string,
  ): Promise<
    Array<{
      content: Buffer
      filename: string
      fileType?: string
      originalUrl?: string
    }>
  > {
    const processedFiles: Array<{
      content: Buffer
      filename: string
      fileType?: string
      originalUrl?: string
    }> = []

    for (const item of fileProcessingItems) {
      let fileContent: Buffer
      let fileType: string | undefined
      let filename: string

      if (item.file) {
        // 处理上传的文件
        const fileExt = extname(item.file.originalname).toLowerCase()
        fileType = fileExt.substring(1)
        fileContent = item.file.buffer
        filename = `${titlePrefix}_${item.fileIndex}_${Date.now()}${fileExt}`
      } else if (item.originalUrl) {
        // 处理URL
        const urlResult = await this.fetchUrlContent(
          item.originalUrl,
          userAgent,
          titlePrefix,
          authors,
          date,
          publisher,
          chapter,
          tags,
          remarks,
        )
        fileContent = urlResult.content
        fileType = urlResult.fileType
        filename = `${titlePrefix}_${item.fileIndex}_${Date.now()}.html`
      } else {
        continue // 跳过无效项目
      }

      const storageFilename = await this.uploadFileToS3(filename, fileContent)

      processedFiles.push({
        content: fileContent,
        filename: storageFilename,
        fileType,
        originalUrl: item.originalUrl,
      })
    }

    return processedFiles
  }

  /**
   * 构建包含关系的查询配置
   */
  private getArchiveIncludeConfig() {
    return {
      tags: {
        include: { tag: true },
      },
      authors: {
        include: { author: true },
        orderBy: { order: "asc" as const },
      },
      publisher: {
        include: { publisher: true },
      },
      date: {
        include: { date: true },
      },
      origs: true,
      comments: {
        orderBy: {
          createdAt: "asc" as const,
        },
      },
    }
  }

  /**
   * 处理标签关系
   */
  private processTags(tags?: string[]) {
    if (!tags || tags.length === 0) return undefined

    return {
      connectOrCreate: tags.map((tag) => ({
        where: { name: tag },
        create: { name: tag },
      })),
    }
  }

  /**
   * 处理作者关系
   */
  private processAuthors(authors?: string[]) {
    if (!authors || authors.length === 0) return undefined

    return {
      create: authors.map((authorName) => ({
        author: {
          connectOrCreate: {
            where: { name: authorName },
            create: { name: authorName },
          },
        },
      })),
    }
  }

  /**
   * 处理出版方关系
   */
  private processPublishers(publisher?: string) {
    if (!publisher) return undefined

    return {
      connectOrCreate: {
        where: { name: publisher },
        create: { name: publisher },
      },
    }
  }

  /**
   * 处理日期关系
   */
  private processDates(date?: string) {
    if (!date) return undefined

    return {
      connectOrCreate: {
        where: { name: date },
        create: { name: date },
      },
    }
  }

  /**
   * 处理原始文件关系
   */
  private processOrigFiles(
    processedFiles: Array<{
      filename: string
      fileType?: string
      originalUrl?: string
    }>,
  ) {
    return {
      create: processedFiles.map((processedFile, index) => ({
        filename: processedFile.filename,
        fileType: processedFile.fileType,
        originalUrl: processedFile.originalUrl,
        orderIndex: index,
      })),
    }
  }

  /**
   * 更新标签关系
   */
  private async updateTagRelations(
    prisma: any,
    archiveId: number,
    tags?: string[],
  ) {
    if (tags === undefined) return

    // 先删除现有的标签关系
    await prisma.archiveTag.deleteMany({
      where: { archiveId },
    })

    // 如果提供了新的标签，创建新的关系
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
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
              archiveId,
              tagId: tag.id,
            },
          })
        }
      }
    }
  }

  /**
   * 更新日期关系
   */
  private async updateDateRelations(
    prisma: any,
    archiveId: number,
    date?: string,
  ) {
    if (date === undefined) return

    // 先删除现有的日期关系
    await prisma.archiveDate.deleteMany({
      where: { archiveId },
    })

    // 如果提供了新的日期，创建新的关系
    if (date && date.trim()) {
      const dateValue = date.trim()

      // 查找或创建日期
      const dateRecord = await prisma.date.upsert({
        where: { value: dateValue },
        create: { value: dateValue },
        update: {},
      })

      // 创建档案-日期关系
      await prisma.archiveDate.create({
        data: {
          archiveId,
          dateId: dateRecord.id,
        },
      })
    }
  }

  /**
   * 更新出版方关系
   */
  private async updatePublisherRelations(
    prisma: any,
    archiveId: number,
    publisher?: string,
  ) {
    if (publisher === undefined) return

    // 先删除现有的出版方关系
    await prisma.archivePublisher.deleteMany({
      where: { archiveId },
    })

    // 如果提供了新的出版方，创建新的关系
    if (publisher && publisher.trim()) {
      const publisherName = publisher.trim()

      // 查找或创建出版方
      const publisherRecord = await prisma.publisher.upsert({
        where: { name: publisherName },
        create: { name: publisherName },
        update: {},
      })

      // 创建档案-出版方关系
      await prisma.archivePublisher.create({
        data: {
          archiveId,
          publisherId: publisherRecord.id,
        },
      })
    }
  }

  /**
   * 更新作者关系
   */
  private async updateAuthorRelations(
    prisma: any,
    archiveId: number,
    authors?: string[],
  ) {
    if (authors === undefined) return

    // 删除现有的作者关系
    await prisma.archiveAuthor.deleteMany({
      where: { archiveId },
    })

    // 创建新的作者关系
    if (authors && authors.length > 0) {
      for (let i = 0; i < authors.length; i++) {
        const authorName = authors[i].trim()
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
              archiveId,
              authorId: author.id,
              order: i + 1,
            },
          })
        }
      }
    }
  }

  /**
   * 预处理文件操作，在事务外部执行耗时操作
   * 优化：先比较新请求与现有记录，只处理不一致的项
   */
  private async prepareFileOperationsForUpdate(
    archiveId: number,
    userAgent: string,
    files?: (Express.Multer.File | string)[],
    originalUrls?: string[],
    titlePrefix?: string,
    authors?: string[],
    date?: string,
    publisher?: string,
    chapter?: string,
    tags?: string[],
    remarks?: string,
  ): Promise<FileOperationResult[]> {
    // 如果没有任何文件相关参数，直接返回空数组
    if (!files?.length && !originalUrls?.length) {
      return []
    }

    this.logger.log(
      `Processing file operations for archive ${archiveId}: files=${files?.length || 0}, originalUrls=${originalUrls?.length || 0}`,
    )

    // 获取现有文件记录，按索引排序
    const existingFiles = await this.prismaService.archiveOrig.findMany({
      where: { archiveId },
      orderBy: { id: "asc" },
    })

    // 计算最大长度（包括现有文件数量，以便正确处理删除操作）
    const maxLength = Math.max(
      files?.length || 0,
      originalUrls?.length || 0,
      existingFiles.length,
    )

    const operations: FileOperationResult[] = []

    // 按索引顺序处理每个位置
    for (let i = 0; i < maxLength; i++) {
      const fileItem = files?.[i]
      const originalUrl = originalUrls?.[i]
      const existingFile = existingFiles[i]

      // 判断是否有操作
      const hasFileOperation = fileItem !== undefined
      const hasOriginalUrl =
        originalUrl !== undefined && originalUrl.trim() !== ""

      this.logger.log(
        `Position ${i}: hasFileOperation=${hasFileOperation} (${typeof fileItem}), hasOriginalUrl=${hasOriginalUrl}, existingFile=${!!existingFile}`,
      )

      // 如果该位置既没有文件操作也没有URL操作，删除现有文件（如果存在）
      if (!hasFileOperation && originalUrl === undefined) {
        if (existingFile) {
          operations.push({
            position: i,
            action: "delete",
            existingFileId: existingFile.id,
          })
        }
        continue
      }

      // 如果该位置没有文件操作但有空字符串的originalUrl，保持现有文件不变
      if (!hasFileOperation && originalUrl === "") {
        // 保持现有文件不变，跳过处理
        operations.push({
          position: i,
          action: "keep",
          existingFileId: existingFile?.id,
        })
        continue
      }

      // 检查当前位置是否与现有记录一致
      const isConsistentWithExisting = this.isFileConsistentWithExisting(
        fileItem,
        originalUrl,
        existingFile,
      )

      if (isConsistentWithExisting) {
        // 与现有记录一致，保持不变
        operations.push({
          position: i,
          action: "keep",
          existingFileId: existingFile?.id,
        })
        continue
      }

      // 不一致，需要更新该位置的文件，先准备新文件数据
      let storageFilename: string
      let fileType: string
      let finalOriginalUrl: string | null = null

      // 处理originalUrl：如果提供了非空URL，保存为originalUrl字段
      if (hasOriginalUrl) {
        finalOriginalUrl = originalUrl.trim()
      }

      // 优先处理文件上传，只有在没有文件上传时才考虑URL抓取
      if (hasFileOperation) {
        // 有文件操作，根据files内容处理
        if (typeof fileItem === "string") {
          // files[i]是storageUrl字符串，直接使用
          storageFilename = fileItem.trim()
          fileType = this.extractFileTypeFromStorageUrl(fileItem) || "html"
        } else {
          // files[i]是File对象，上传新文件
          this.logger.log(
            `Uploading new file: ${fileItem.originalname} at position ${i}`,
          )
          const fileExt = extname(fileItem.originalname).toLowerCase()
          fileType = fileExt.substring(1)
          const filename = `${titlePrefix || "updated"}_${i}_${Date.now()}${fileExt}`

          storageFilename = await this.uploadFileToS3(filename, fileItem.buffer)
          this.logger.log(
            `File uploaded successfully: ${storageFilename} at position ${i}`,
          )
        }
      } else if (hasOriginalUrl) {
        // 没有文件上传但有URL，从URL抓取内容
        const urlResult = await this.fetchUrlContent(
          originalUrl.trim(),
          userAgent,
          titlePrefix || "updated",
          authors,
          date,
          publisher,
          chapter,
          tags,
          remarks,
        )

        const filename = `${titlePrefix || "updated"}_${i}_${Date.now()}.html`
        storageFilename = await this.uploadFileToS3(filename, urlResult.content)
        fileType = urlResult.fileType
      } else {
        // 这种情况理论上不应该发生，因为前面的条件已经过滤了
        continue
      }

      // 添加创建操作
      operations.push({
        position: i,
        action: "create",
        data: {
          originalUrl: finalOriginalUrl || undefined,
          storageUrl: storageFilename,
          fileType,
          storageType: "s3",
        },
        existingFileId: existingFile?.id,
      })
    }

    return operations
  }

  /**
   * 检查请求的文件项是否与现有记录一致
   */
  private isFileConsistentWithExisting(
    fileItem: Express.Multer.File | string | undefined,
    originalUrl: string | undefined,
    existingFile: any,
  ): boolean {
    // 如果没有现有文件，肯定不一致
    if (!existingFile) {
      return false
    }

    const hasFileOperation = fileItem !== undefined
    const hasOriginalUrl =
      originalUrl !== undefined && originalUrl.trim() !== ""

    // 情况1: 只有originalUrl，检查是否与现有记录的originalUrl一致
    if (hasOriginalUrl && !hasFileOperation) {
      const requestOriginalUrl = originalUrl.trim()
      return existingFile.originalUrl === requestOriginalUrl
    }

    // 情况2: 只有文件操作（storageUrl字符串），检查是否与现有记录的storageUrl一致
    if (hasFileOperation && !hasOriginalUrl) {
      if (typeof fileItem === "string") {
        const requestStorageUrl = fileItem.trim()
        return existingFile.storageUrl === requestStorageUrl
      }
      // 如果是File对象，肯定是新上传的文件，不一致
      return false
    }

    // 情况3: 既有originalUrl又有文件操作
    if (hasOriginalUrl && hasFileOperation) {
      // 优先基于文件操作来判断一致性，因为文件上传优先级更高
      if (typeof fileItem === "string") {
        const requestStorageUrl = fileItem.trim()
        // 同时检查storageUrl和originalUrl都一致
        const requestOriginalUrl = originalUrl.trim()
        return (
          existingFile.storageUrl === requestStorageUrl &&
          existingFile.originalUrl === requestOriginalUrl
        )
      }
      // 如果是File对象，肯定是新上传的文件，不一致
      return false
    }

    // 其他情况，如空字符串的originalUrl等，在上层已经处理
    return false
  }

  /**
   * 在事务内部快速应用文件操作结果
   */
  private async applyFileOperations(
    prisma: any,
    archiveId: number,
    operations: FileOperationResult[],
  ) {
    for (const operation of operations) {
      if (operation.action === "delete" && operation.existingFileId) {
        await prisma.archiveOrig.delete({
          where: { id: operation.existingFileId },
        })
      } else if (operation.action === "create") {
        // 如果有现有文件，先删除
        if (operation.existingFileId) {
          await prisma.archiveOrig.delete({
            where: { id: operation.existingFileId },
          })
        }

        // 创建新记录
        if (operation.data) {
          await prisma.archiveOrig.create({
            data: {
              archiveId,
              ...operation.data,
            },
          })
        }
      }
      // "keep" 操作不需要做任何事情
    }
  }

  /**
   * 智能处理文件操作：支持files数组包含File对象或storageUrl字符串的混合模式
   */
  private async handleSmartFileOperations(
    prisma: any,
    archiveId: number,
    userAgent: string,
    files?: (Express.Multer.File | string)[],
    originalUrls?: string[],
    titlePrefix?: string,
    authors?: string[],
    date?: string,
    publisher?: string,
    chapter?: string,
    tags?: string[],
    remarks?: string,
  ) {
    // 如果没有任何文件相关参数，直接返回
    if (!files?.length && !originalUrls?.length) {
      return
    }

    // 获取现有文件记录，按索引排序
    const existingFiles = await prisma.archiveOrig.findMany({
      where: { archiveId },
      orderBy: { id: "asc" },
    })

    // 计算最大长度（包括现有文件数量，以便正确处理删除操作）
    const maxLength = Math.max(
      files?.length || 0,
      originalUrls?.length || 0,
      existingFiles.length,
    )

    // 按索引顺序处理每个位置
    for (let i = 0; i < maxLength; i++) {
      const fileItem = files?.[i]
      const originalUrl = originalUrls?.[i]
      const existingFile = existingFiles[i]

      // 判断是否有操作
      const hasFileOperation = fileItem !== undefined
      const hasOriginalUrl =
        originalUrl !== undefined && originalUrl.trim() !== ""

      // 如果该位置既没有文件操作也没有URL操作，删除现有文件（如果存在）
      if (!hasFileOperation && originalUrl === undefined) {
        if (existingFile) {
          await prisma.archiveOrig.delete({
            where: { id: existingFile.id },
          })
        }
        continue
      }

      // 如果该位置没有文件操作但有空字符串的originalUrl，保持现有文件不变
      if (!hasFileOperation && originalUrl === "") {
        // 保持现有文件不变，跳过处理
        continue
      }

      // 需要更新该位置的文件，先删除现有文件（如果存在）
      if (existingFile) {
        await prisma.archiveOrig.delete({
          where: { id: existingFile.id },
        })
      }

      // 处理文件操作
      let storageFilename: string
      let fileType: string
      let finalOriginalUrl: string | null = null

      // 处理originalUrl：如果提供了非空URL，保存为originalUrl字段
      if (hasOriginalUrl) {
        finalOriginalUrl = originalUrl.trim()
      }

      // 检查是否需要从URL抓取内容
      if (hasOriginalUrl) {
        // 从URL抓取内容，优先使用URL内容
        const urlResult = await this.fetchUrlContent(
          originalUrl.trim(),
          userAgent,
          titlePrefix || "updated",
          authors,
          date,
          publisher,
          chapter,
          tags,
          remarks,
        )

        const filename = `${titlePrefix || "updated"}_${i}_${Date.now()}.html`
        storageFilename = await this.uploadFileToS3(filename, urlResult.content)
        fileType = urlResult.fileType
      } else if (hasFileOperation) {
        // 没有URL或URL为空，根据files内容处理
        if (typeof fileItem === "string") {
          // files[i]是storageUrl字符串，保持现有文件不变
          storageFilename = fileItem.trim()
          fileType = this.extractFileTypeFromStorageUrl(fileItem) || "html"
        } else {
          // files[i]是File对象，上传新文件
          const fileExt = extname(fileItem.originalname).toLowerCase()
          fileType = fileExt.substring(1)
          const filename = `${titlePrefix || "updated"}_${i}_${Date.now()}${fileExt}`

          storageFilename = await this.uploadFileToS3(filename, fileItem.buffer)
        }
      } else {
        // 这种情况理论上不应该发生，因为前面的条件已经过滤了
        continue
      }

      // 创建新的数据库记录
      await prisma.archiveOrig.create({
        data: {
          archiveId,
          originalUrl: finalOriginalUrl,
          storageUrl: storageFilename,
          fileType,
          storageType: "s3",
        },
      })
    }
  }

  /**
   * 从storageUrl中提取文件类型
   */
  private extractFileTypeFromStorageUrl(storageUrl: string): string | null {
    const ext = extname(storageUrl).toLowerCase()
    return ext ? ext.substring(1) : null
  }

  async create(
    createArchiveDto: CreateArchiveDto,
    userAgent: string,
    files?: Express.Multer.File[],
  ) {
    // DTO 层已确保 chapter 不为空且为字符串，这里只需验证有效性
    this.validateChapter(createArchiveDto.chapter)

    const archive: ICreateArchive = {
      ...createArchiveDto,
    }

    try {
      // 检查是否提供了文件或URL
      if (!files?.length && !archive.originalUrls?.length) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: "Either files or originalUrls must be provided",
        })
      }

      // 准备文件处理项目
      const fileProcessingItems = this.prepareFileProcessingItems(
        files,
        archive.originalUrls,
      )

      if (fileProcessingItems.length === 0) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: "No valid files or URLs provided",
        })
      }

      // 处理文件项目
      const processedFiles = await this.processFileItems(
        fileProcessingItems,
        createArchiveDto.title,
        userAgent,
        archive.authors,
        archive.date,
        archive.publisher,
        archive.chapter,
        archive.tags,
        archive.remarks,
      )

      if (processedFiles.length === 0) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: "No files were successfully processed",
        })
      }

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

          // 为每个处理的文件创建档案原始文件记录
          for (const processedFile of processedFiles) {
            await prisma.archiveOrig.create({
              data: {
                archiveId: newArchive.id,
                originalUrl: processedFile.originalUrl,
                storageUrl: processedFile.filename,
                fileType: processedFile.fileType,
                storageType: "s3",
              },
            })
          }

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
            include: this.getArchiveIncludeConfig(),
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
        include: this.getArchiveIncludeConfig(),
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
      const includeConfig = this.getArchiveIncludeConfig()
      const archive = await this.prismaService.archive.findUnique({
        where: { id },
        include: {
          ...includeConfig,
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

  async update(
    id: number,
    updateArchiveDto: UpdateArchiveDto,
    userAgent: string,
    files?: Express.Multer.File[],
  ) {
    try {
      // 验证章节类别（更新时可选但如果提供必须有效）
      this.validateChapter(updateArchiveDto.chapter)

      await this.findOne(id, false)

      // 预处理文件操作（在事务外部执行耗时操作）
      // 将 Express.Multer.File[] 转换为 (Express.Multer.File | string)[] 类型
      const fileOperations = await this.prepareFileOperationsForUpdate(
        id,
        userAgent,
        files as (Express.Multer.File | string)[] | undefined,
        updateArchiveDto.originalUrls,
        updateArchiveDto.title || "updated",
        updateArchiveDto.authors,
        updateArchiveDto.date,
        updateArchiveDto.publisher,
        updateArchiveDto.chapter,
        updateArchiveDto.tags,
        updateArchiveDto.remarks,
      )

      // 使用事务更新档案和关系数据
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
        await this.updateTagRelations(prisma, id, updateArchiveDto.tags)

        // 处理日期关系更新
        await this.updateDateRelations(prisma, id, updateArchiveDto.date)

        // 处理出版方关系更新
        await this.updatePublisherRelations(
          prisma,
          id,
          updateArchiveDto.publisher,
        )

        // 处理作者关系更新
        await this.updateAuthorRelations(prisma, id, updateArchiveDto.authors)

        // 应用文件操作结果（快速数据库操作）
        await this.applyFileOperations(prisma, id, fileOperations)

        // 返回包含作者、出版方、日期、标签和原始文件信息的档案
        return prisma.archive.findUnique({
          where: { id },
          include: this.getArchiveIncludeConfig(),
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

  async findPendingOrigs(queryDto: QueryPendingOrigsDto, userId: string) {
    try {
      const { status = "pending" } = queryDto

      // 获取用户的邮箱白名单
      const userWhitelist = await this.prismaService.emailWhitelist.findMany({
        where: { userId },
        select: { email: true },
      })

      // 提取邮箱地址数组
      const whitelistEmails = userWhitelist.map((item) => item.email)

      // 如果用户没有邮箱白名单，返回空数据
      if (whitelistEmails.length === 0) {
        return {
          success: true,
          data: [],
          message: "No email whitelist found for user",
        }
      }

      const pendingOrigs = await this.prismaService.pendingArchiveOrig.findMany(
        {
          where: {
            status,
            senderEmail: { in: whitelistEmails },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            senderEmail: true,
            messageId: true,
            subject: true,
            originalFilename: true,
            storageUrl: true,
            fileType: true,
            status: true,
          },
        },
      )

      return {
        success: true,
        data: pendingOrigs,
        message: "Pending archive origs retrieved successfully",
      }
    } catch (error) {
      this.handleError(error, "fetch pending origs")
    }
  }
}
