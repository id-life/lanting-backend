import { HttpService } from "@nestjs/axios"
import { Injectable, InternalServerErrorException } from "@nestjs/common"
import { firstValueFrom } from "rxjs"
import { DeepSeekService } from "@/common/deepseek/deepseek.service"
import { MetadataExtractorService } from "@/common/metadata-extractor/metadata-extractor.service"

@Injectable()
export class TributeService {
  constructor(
    private readonly httpService: HttpService,
    private readonly metadataExtractorService: MetadataExtractorService,
    private readonly deepSeekService: DeepSeekService,
  ) {}

  async getInfo(link: string) {
    try {
      // 确保URL格式正确（添加协议前缀）
      let url = link
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`
      }

      // 获取页面内容
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          timeout: 10000,
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

      return {
        success: true,
        data: {
          ...metadata,
          summary: analysis.summary,
          keywords: {
            predefined: [],
            extracted: analysis.keywords.extracted,
          },
        },
      }
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
      const htmlContent = file.buffer.toString("utf8")

      // 从 HTML 内容提取元数据
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

      const info = {
        ...metadata,
        summary: analysis.summary,
        keywords: {
          predefined: [],
          extracted: analysis.keywords.extracted,
        },
      }

      return {
        success: true,
        data: {
          title: info.title || undefined,
          author: info.author || undefined,
          publisher: info.publisher || undefined,
          date: info.date || undefined,
          summary: info.summary || undefined,
          keywords: info.keywords || { predefined: [], extracted: [] },
        },
      }
    } catch (error) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: `Failed to extract HTML: ${error.message}`,
      })
    }
  }
}
