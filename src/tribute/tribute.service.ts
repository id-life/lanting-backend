import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { HttpService } from "@nestjs/axios"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common"
import { Cache } from "cache-manager"
import { firstValueFrom } from "rxjs"
import { AwsService } from "@/common/aws/aws.service"
import { DeepSeekService } from "@/common/deepseek/deepseek.service"
import { MetadataExtractorService } from "@/common/metadata-extractor/metadata-extractor.service"
import { PrismaService } from "@/common/prisma/prisma.service"
import { ConfigService } from "@/config/config.service"

@Injectable()
export class TributeService {
  constructor(
    private readonly httpService: HttpService,
    private readonly metadataExtractorService: MetadataExtractorService,
    private readonly deepSeekService: DeepSeekService,
    private readonly awsService: AwsService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getInfo(link: string, userAgent: string) {
    // 使用URL作为缓存键，确保URL的一致性
    let normalizedUrl = link
    if (
      normalizedUrl &&
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    const cacheKey = `tribute_info:${normalizedUrl.replace(/\W/g, "_")}`

    try {
      // 先尝试从缓存获取
      const cachedResult = await this.cacheManager.get(cacheKey)
      if (cachedResult) {
        return cachedResult
      }

      // 缓存未命中，进行网页分析
      // 确保URL格式正确（添加协议前缀）
      let url = link
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`
      }

      // 获取页面内容
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            "User-Agent": userAgent,
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            // "Accept-Language": "en-US,en;q=0.5",
          },
          timeout: 120_000,
        }),
      )

      // 确保响应数据是字符串
      const htmlContent =
        typeof response.data === "string"
          ? response.data
          : String(response.data)

      // 从HTML内容提取元数据
      const metadata =
        this.metadataExtractorService.extractMetadataFromHtml(htmlContent)

      // 提取文章内容（用于分析）
      const articleContent =
        this.metadataExtractorService.extractArticleContent(htmlContent)

      // 使用 deepseek 分析内容
      const analysis = await this.deepSeekService.analyzeContent(
        metadata.title || "",
        articleContent,
        15,
      )

      const result = {
        success: true,
        data: {
          ...metadata,
          summary: analysis.summary,
          highlights: analysis.highlights,
          keywords: {
            predefined: [],
            extracted: analysis.keywords.extracted,
          },
        },
        message: "Tribute info retrieved successfully",
      }

      // 缓存结果，网页信息缓存1小时（内容相对稳定）
      await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000)

      return result
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: `Failed to fetch tribute info: ${error.message}`,
      })
    }
  }

  getContent(filename: string) {
    return `This is GET /tribute/content/${filename} endpoint`
  }

  async extractHtml({
    user,
    file,
    pendingOrigId,
  }: {
    user: { id?: string }
    file?: Express.Multer.File | null
    pendingOrigId?: number
  }) {
    try {
      if (typeof pendingOrigId === "number") {
        return await this.extractFromPendingOrig(user?.id, pendingOrigId)
      }

      if (file) {
        return await this.extractHtmlFromBuffer(file.buffer)
      }

      throw new BadRequestException({
        success: false,
        data: null,
        message: "Either file or pendingOrigId must be provided",
      })
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: `Failed to extract HTML: ${error.message}`,
      })
    }
  }

  private async extractFromPendingOrig(
    userId: string | undefined,
    pendingOrigId: number,
  ) {
    if (!userId) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: "User information is required to access pending files",
      })
    }

    const whitelistEmails = await this.getUserWhitelistEmails(userId)

    if (whitelistEmails.length === 0) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: "User is not authorized to access pending files",
      })
    }

    const pendingOrig = await this.prismaService.pendingArchiveOrig.findFirst({
      where: {
        id: pendingOrigId,
        status: "pending",
        senderEmail: { in: whitelistEmails },
      },
    })

    if (!pendingOrig) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: `Pending file with ID ${pendingOrigId} is not available`,
      })
    }

    const filePath = this.resolveStoragePath(pendingOrig.storageUrl)
    const fileBuffer = await this.awsService.getFileContent(filePath)

    return this.extractHtmlFromBuffer(fileBuffer)
  }

  private async extractHtmlFromBuffer(buffer: Buffer) {
    const fileContent = buffer.toString("utf8")
    return this.buildHtmlExtractionResponse(fileContent)
  }

  private async buildHtmlExtractionResponse(fileContent: string) {
    // 基于文件内容创建缓存键
    const contentHash = createHash("md5").update(fileContent).digest("hex")
    const cacheKey = `tribute_extract:${contentHash}`

    // 先尝试从缓存获取
    const cachedResult = await this.cacheManager.get(cacheKey)
    if (cachedResult) {
      return cachedResult
    }

    // 从 HTML 内容提取元数据
    const metadata =
      this.metadataExtractorService.extractMetadataFromHtml(fileContent)

    // 提取文章内容（用于分析）
    const articleContent =
      this.metadataExtractorService.extractArticleContent(fileContent)

    // 使用 deepseek 分析内容
    const analysis = await this.deepSeekService.analyzeContent(
      metadata.title || "",
      articleContent,
      15,
    )

    const info = {
      ...metadata,
      summary: analysis.summary,
      highlights: analysis.highlights,
      keywords: {
        predefined: [],
        extracted: analysis.keywords.extracted,
      },
    }

    const result = {
      success: true,
      data: {
        title: info.title || undefined,
        author: info.author || undefined,
        publisher: info.publisher || undefined,
        date: info.date || undefined,
        summary: info.summary || undefined,
        highlights: info.highlights || [],
        keywords: info.keywords || { predefined: [], extracted: [] },
      },
      message: "HTML content extracted successfully",
    }

    // 缓存结果，HTML分析结果缓存1小时（内容基于文件哈希，相同文件内容结果一致）
    await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000)

    return result
  }

  private async getUserWhitelistEmails(userId: string): Promise<string[]> {
    const whitelist = await this.prismaService.emailWhitelist.findMany({
      where: { userId },
      select: { email: true },
    })

    return whitelist.map((item) => item.email)
  }

  private resolveStoragePath(storageUrl: string): string {
    if (!storageUrl) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: "Pending file storage path is missing",
      })
    }

    if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
      return storageUrl
    }

    if (storageUrl.startsWith(`${this.configService.awsS3Directory}/`)) {
      return storageUrl
    }

    return `${this.configService.awsS3Directory}/${storageUrl}`
  }
}
