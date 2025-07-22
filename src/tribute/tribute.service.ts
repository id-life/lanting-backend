import { createHash } from "node:crypto"
import { HttpService } from "@nestjs/axios"
import { CACHE_MANAGER } from "@nestjs/cache-manager"
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common"
import { Cache } from "cache-manager"
import { firstValueFrom } from "rxjs"
import { DeepSeekService } from "@/common/deepseek/deepseek.service"
import { MetadataExtractorService } from "@/common/metadata-extractor/metadata-extractor.service"

@Injectable()
export class TributeService {
  constructor(
    private readonly httpService: HttpService,
    private readonly metadataExtractorService: MetadataExtractorService,
    private readonly deepSeekService: DeepSeekService,
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

  async extractHtml(file: Express.Multer.File) {
    try {
      // 基于文件内容创建缓存键
      const fileContent = file.buffer.toString("utf8")
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
          keywords: info.keywords || { predefined: [], extracted: [] },
        },
        message: "HTML content extracted successfully",
      }

      // 缓存结果，HTML分析结果缓存1小时（内容基于文件哈希，相同文件内容结果一致）
      await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000)

      return result
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: `Failed to extract HTML: ${error.message}`,
      })
    }
  }
}
