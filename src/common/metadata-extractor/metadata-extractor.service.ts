import { Injectable, Logger } from "@nestjs/common"
import { JSDOM } from "jsdom"
import { DateUtilService } from "../date-util/date-util.service"

export interface Tribute {
  title?: string
  author?: string
  publisher?: string
  date?: string
  keywords?: {
    predefined?: string[]
    extracted?: string[]
  }
}

@Injectable()
export class MetadataExtractorService {
  private readonly logger = new Logger(MetadataExtractorService.name)

  constructor(private readonly dateUtil: DateUtilService) {}

  extractMetadataFromHtml(htmlContent: string): Partial<Tribute> {
    try {
      const dom = new JSDOM(htmlContent)
      const document = dom.window.document

      // 初始化返回对象
      const result: Partial<Tribute> = {}

      // 检查是否为微信公众平台页面
      const isWechatArticle = this.checkIsWechatArticle(document)

      // 提取标题 - 优先使用 meta 标签，然后是 title 标签
      this.extractTitle(document, result)

      // 提取作者 - 通过多种可能的 meta 标签
      this.extractAuthor(document, result)

      // 针对微信公众号文章的特殊处理
      if (isWechatArticle) {
        this.extractWechatMetadata(document, result)
      } else {
        this.extractGenericMetadata(document, result)
      }

      // 提取日期 - 多种策略
      // 如果是微信文章且已经提取到日期，跳过通用日期提取
      if (!isWechatArticle || !result.date) {
        this.extractDateFromHtml(document, result)
      }

      // 确保所有未提取到的字段返回 undefined
      this.ensureNullForMissingFields(result)

      return result
    } catch {
      // 出错时返回所有字段为 undefined 的对象
      return this.createNullFieldsObject()
    }
  }

  /**
   * 检查HTML文档是否为微信公众号文章
   * @param document DOM文档
   * @returns 是否为微信公众号文章
   */
  checkIsWechatArticle(document: Document): boolean {
    // 检查meta标签中是否有微信公众平台的标识
    const metaSiteName = document.querySelector('meta[property="og:site_name"]')
    if (
      metaSiteName &&
      metaSiteName.getAttribute("content")?.includes("微信公众平台")
    ) {
      return true
    }

    // 检查URL是否包含微信域名
    const canonicalLink = document.querySelector('link[rel="canonical"]')
    if (
      canonicalLink &&
      canonicalLink.getAttribute("href")?.includes("weixin.qq.com")
    ) {
      return true
    }

    // 检查页面内容是否包含微信特有的元素
    if (
      document.querySelector("#js_name") &&
      document.querySelector("#publish_time")
    ) {
      return true
    }

    return false
  }

  /**
   * 提取HTML文档中的标题
   * @param document DOM文档
   * @param result 结果对象
   */
  extractTitle(document: Document, result: Partial<Tribute>): void {
    const metaTitle = document.querySelector(
      'meta[property="og:title"], meta[name="twitter:title"], meta[name="title"]',
    )
    if (metaTitle && metaTitle.getAttribute("content")) {
      const content = metaTitle.getAttribute("content")
      if (content) {
        result.title = content
      } else {
        result.title = undefined
      }
    } else {
      const titleTag = document.querySelector("title")
      if (titleTag && titleTag.textContent) {
        result.title = titleTag.textContent
      } else {
        result.title = undefined
      }
    }
  }

  /**
   * 提取HTML文档中的作者信息
   * @param document DOM文档
   * @param result 结果对象
   */
  extractAuthor(document: Document, result: Partial<Tribute>): void {
    const metaAuthor = document.querySelector(
      'meta[property="og:article:author"], meta[name="author"], meta[name="twitter:creator"]',
    )
    if (metaAuthor && metaAuthor.getAttribute("content")) {
      const content = metaAuthor.getAttribute("content")
      if (content) {
        result.author = content
      } else {
        result.author = undefined
      }
    } else {
      result.author = undefined
    }
  }

  /**
   * 提取微信公众号文章的特定元数据
   * @param document DOM文档
   * @param result 结果对象
   */
  extractWechatMetadata(document: Document, result: Partial<Tribute>): void {
    // 提取微信公众号名称
    this.extractWechatPublisher(document, result)

    // 提取微信文章日期
    this.extractWechatDate(document, result)

    // 如果没有找到作者，尝试从微信特定元素提取
    if (!result.author || result.author === undefined) {
      this.extractWechatAuthor(document, result)
    }
  }

  /**
   * 提取微信公众号名称
   * @param document DOM文档
   * @param result 结果对象
   */
  extractWechatPublisher(document: Document, result: Partial<Tribute>): void {
    const publisherElement = document.querySelector("#js_name")
    if (publisherElement && publisherElement.textContent) {
      const publisherText = publisherElement.textContent.trim()
      if (publisherText) {
        result.publisher = publisherText
      } else {
        result.publisher = undefined
      }
    } else {
      result.publisher = undefined
    }
  }

  /**
   * 提取微信文章日期
   * @param document DOM文档
   * @param result 结果对象
   */
  extractWechatDate(document: Document, result: Partial<Tribute>): void {
    let dateText = ""

    // 方法1：尝试从页面脚本中提取createTime
    const htmlContent = document.documentElement.outerHTML
    const createTimeMatch = htmlContent.match(
      /var\s+createTime\s*=\s*["']([^"']+)["'];?/,
    )
    if (createTimeMatch) {
      dateText = createTimeMatch[1]
    }

    // 方法2：如果没有找到createTime，尝试从DOM元素获取
    if (!dateText) {
      const dateElement = document.getElementById("publish_time")
      if (dateElement && dateElement.textContent) {
        dateText = dateElement.textContent.trim()
      }
    }

    if (dateText) {
      // 处理常见的微信日期格式
      // 1. 标准格式："2025年03月31日 14:15"
      let match = dateText.match(/(\d{4})年(\d{2})月(\d{2})日/)
      if (match) {
        // 保存完整日期格式 YYYY-MM-DD
        result.date = `${match[1]}-${match[2]}-${match[3]}`
      }
      // 2. 特殊格式："今天"、"昨天"、"前天"
      else if (
        dateText.includes("今天") ||
        dateText.includes("昨天") ||
        dateText.includes("前天") ||
        dateText.includes("days ago") ||
        dateText.includes("day ago") ||
        dateText.includes("小时前") ||
        dateText.includes("分钟前")
      ) {
        // 对于相对日期，使用当前日期
        const now = new Date()
        const year = now.getFullYear()
        const month = (now.getMonth() + 1).toString().padStart(2, "0")
        const day = now.getDate().toString().padStart(2, "0")
        result.date = `${year}-${month}-${day}`
      }
      // 3. 月日格式："MM月DD日"，假设是当年
      // TODO
      // eslint-disable-next-line no-cond-assign
      else if ((match = dateText.match(/(\d{1,2})月(\d{1,2})日/))) {
        const now = new Date()
        const year = now.getFullYear()
        const month = match[1].padStart(2, "0")
        const day = match[2].padStart(2, "0")
        result.date = `${year}-${month}-${day}`
      }
      // 4. 使用通用提取方法
      else {
        const extractedDate = this.dateUtil.extractDateFromString(dateText)
        if (extractedDate) {
          result.date = extractedDate.date
        } else {
          result.date = undefined
        }
      }
    } else {
      result.date = undefined
    }
  }

  /**
   * 提取微信文章作者
   * @param document DOM文档
   * @param result 结果对象
   */
  extractWechatAuthor(document: Document, result: Partial<Tribute>): void {
    const dateElement = document.querySelector("#publish_time")
    const authorElements = document.querySelectorAll(
      ".rich_media_meta.rich_media_meta_text",
    )
    let authorFound = false

    for (const el of authorElements) {
      // 排除带有ID的元素（通常是时间），作者元素通常没有ID
      if (!el.id && el.id !== "publish_time") {
        const authorText = el.textContent?.trim()
        if (authorText && authorText !== dateElement?.textContent?.trim()) {
          result.author = authorText
          authorFound = true
          break
        }
      }
    }

    if (!authorFound) {
      result.author = undefined
    }
  }

  /**
   * 提取通用网页元数据
   * @param document DOM文档
   * @param result 结果对象
   */
  extractGenericMetadata(document: Document, result: Partial<Tribute>): void {
    // 提取出版方 - 通常是网站名称
    const metaPublisher = document.querySelector(
      'meta[property="og:site_name"], meta[name="application-name"]',
    )
    if (metaPublisher && metaPublisher.getAttribute("content")) {
      const content = metaPublisher.getAttribute("content")
      if (content) {
        result.publisher = content
      } else {
        result.publisher = undefined
      }
    } else {
      result.publisher = undefined
    }
  }

  /**
   * 从HTML元素中提取日期信息
   * @param document DOM文档
   * @param result 结果对象
   */
  extractDateFromHtml(document: Document, result: Partial<Tribute>): void {
    // 1. 首先尝试从元数据中提取
    let dateFound = false
    const metaDateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[name="pubdate"]',
      'meta[property="og:published_time"]',
      'meta[name="publish_date"]',
      'meta[name="article:published_time"]',
      'meta[itemprop="datePublished"]',
      'meta[name="datePublished"]',
    ]

    for (const selector of metaDateSelectors) {
      if (dateFound) break

      const metaDate = document.querySelector(selector)
      if (metaDate && metaDate.getAttribute("content")) {
        const dateStr = metaDate.getAttribute("content")
        if (dateStr) {
          try {
            const date = new Date(dateStr)
            if (!Number.isNaN(date.getTime())) {
              const year = date.getFullYear()
              const month = (date.getMonth() + 1).toString().padStart(2, "0")
              const day = date.getDate().toString().padStart(2, "0")
              result.date = `${year}-${month}-${day}`
              dateFound = true
            }
          } catch (error) {
            this.logger.error("Error parsing date from meta tag:", error)
          }
        }
      }
    }

    // 2. 查找具有时间相关属性的HTML元素
    if (!dateFound) {
      const timeSelectors = [
        "time[datetime]",
        '[itemprop="datePublished"]',
        ".publish-date",
        ".post-date",
        ".entry-date",
        ".article-date",
        ".article__date",
        ".article-meta time",
        ".news-date",
        ".date",
        ".time",
      ]

      for (const selector of timeSelectors) {
        if (dateFound) break

        const timeElements = document.querySelectorAll(selector)
        for (const element of timeElements) {
          // 优先使用datetime属性
          const datetime = element.getAttribute("datetime")
          if (datetime) {
            try {
              const date = new Date(datetime)
              if (!Number.isNaN(date.getTime())) {
                const year = date.getFullYear()
                const month = (date.getMonth() + 1).toString().padStart(2, "0")
                const day = date.getDate().toString().padStart(2, "0")
                result.date = `${year}-${month}-${day}`
                dateFound = true
                break
              }
            } catch (error) {
              this.logger.error("Error parsing datetime attribute:", error)
            }
          }

          // 使用元素内文本
          if (!dateFound && element.textContent) {
            const text = element.textContent.trim()
            const extractedDate = this.dateUtil.extractDateFromString(text)
            if (extractedDate) {
              result.date = extractedDate.date
              dateFound = true
              break
            }
          }
        }
      }
    }

    // 3. 如果仍未找到日期，尝试查找页面中的日期字符串
    if (!dateFound) {
      // 查找含有日期的文本节点
      const possibleDateContainers = document.querySelectorAll(
        "p, span, div, h1, h2, h3, h4, h5, h6",
      )

      for (const element of possibleDateContainers) {
        if (dateFound) break

        const text = element.textContent?.trim()
        if (text) {
          const extractedDate = this.dateUtil.extractDateFromString(text)
          if (extractedDate) {
            result.date = extractedDate.date
            dateFound = true
          }
        }
      }
    }

    // 如果所有方法都未找到日期，设置为undefined
    if (!dateFound) {
      result.date = undefined
    }
  }

  /**
   * 确保所有未提取到的字段返回对应值
   * @param result 结果对象
   */
  ensureNullForMissingFields(result: Partial<Tribute>): void {
    // 处理基本字段
    if (!result.title) result.title = undefined
    if (!result.author) result.author = undefined
    if (!result.publisher) result.publisher = undefined
    if (!result.date) result.date = undefined

    // 对于复杂类型的字段，提供默认值而不是 undefined 字符串
    if (!result.keywords) {
      result.keywords = {
        predefined: [],
        extracted: [],
      }
    }
  }

  /**
   * 创建所有字段为 undefined 的对象
   * @returns 所有字段为 undefined 的对象
   */
  createNullFieldsObject(): Partial<Tribute> {
    return {
      title: undefined,
      author: undefined,
      publisher: undefined,
      date: undefined,
      keywords: {
        predefined: [],
        extracted: [],
      },
    }
  }

  /**
   * 从HTML内容中提取文章主体内容
   * @param htmlContent HTML内容
   * @returns 提取的文章内容文本
   */
  extractArticleContent(htmlContent: string): string {
    try {
      const dom = new JSDOM(htmlContent)
      const document = dom.window.document

      // 尝试不同策略提取文章主体内容
      let content = ""
      let paragraphs: Element[] = []

      // 策略1：尝试提取article标签内容
      const article = document.querySelector("article")
      if (article) {
        // 获取article中的所有段落
        paragraphs = Array.from(
          article.querySelectorAll("p, h1, h2, h3, h4, h5, h6"),
        )
        if (paragraphs.length > 3) {
          // 至少有几个段落才认为是有效内容
          content = this.extractParagraphsWithStructure(paragraphs)
        } else {
          content = article.textContent || ""
        }
      }

      // 策略2：尝试提取特定class的内容（常见于新闻网站）
      if (!content || content.trim().length < 50) {
        const contentSelectors = [
          ".article-content",
          ".post-content",
          ".entry-content",
          ".rich_media_content",
          "#js_content", // 微信公众号
          ".article",
          ".main-content",
          ".content",
          ".zhihu-content",
          ".ztext", // 知乎
        ]

        for (const selector of contentSelectors) {
          const contentElement = document.querySelector(selector)
          if (contentElement) {
            // 提取段落
            paragraphs = Array.from(
              contentElement.querySelectorAll("p, h1, h2, h3, h4, h5, h6"),
            )
            if (paragraphs.length > 3) {
              content = this.extractParagraphsWithStructure(paragraphs)
              if (content.trim().length >= 50) break
            } else {
              // 如果找不到足够的段落，就使用整个元素的文本
              content = contentElement.textContent || ""
              if (content.trim().length >= 50) break
            }
          }
        }
      }

      // 策略3：尝试提取meta description
      if (!content || content.trim().length < 50) {
        const metaDesc = document.querySelector(
          'meta[name="description"], meta[property="og:description"]',
        )
        if (metaDesc && metaDesc.getAttribute("content")) {
          content = metaDesc.getAttribute("content") || ""
        }
      }

      // 策略4: 如果上述方法都失败，尝试获取所有段落文本
      if (!content || content.trim().length < 50) {
        // 尝试获取所有段落文本
        paragraphs = Array.from(document.querySelectorAll("p"))
        if (paragraphs.length > 0) {
          content = this.extractParagraphsWithStructure(paragraphs)
        }
      }

      // 策略5：如果所有方法都失败，获取body的所有文本
      if (!content || content.trim().length < 50) {
        const body = document.querySelector("body")
        if (body) {
          // 移除脚本、样式等元素
          Array.from(
            body.querySelectorAll(
              "script, style, nav, header, footer, .comments, .sidebar, .ad",
            ),
          ).forEach((el) => {
            if (el.parentNode) {
              el.parentNode.removeChild(el)
            }
          })

          // 尝试从body中获取所有段落
          paragraphs = Array.from(
            body.querySelectorAll("p, h1, h2, h3, h4, h5, h6"),
          )
          if (paragraphs.length > 3) {
            content = this.extractParagraphsWithStructure(paragraphs)
          } else {
            content = body.textContent || ""
          }
        }
      }

      // 清理文本
      content = this.cleanTextContent(content)

      return content
    } catch {
      return ""
    }
  }

  /**
   * 从段落元素中提取文本，保留结构
   * @param paragraphs 段落元素数组
   * @returns 提取的文本，保留段落结构
   */
  extractParagraphsWithStructure(paragraphs: Element[]): string {
    const validParagraphs = paragraphs
      .map((p) => {
        const text = p.textContent?.trim() || ""
        const tagName = p.tagName.toLowerCase()

        // 给标题添加特殊标记
        if (tagName.startsWith("h") && text) {
          const level = Number.parseInt(tagName.substring(1))
          // 根据标题级别添加标记
          return `\n${"#".repeat(level)} ${text}\n`
        }

        return text
      })
      .filter((text) => text.length > 0) // 过滤空段落

    return validParagraphs.join("\n\n")
  }

  /**
   * 清理提取的文本内容
   * @param content 原始文本
   * @returns 清理后的文本
   */
  cleanTextContent(content: string): string {
    if (!content) return ""

    let cleanedText = content
      // 移除多余空白
      .replace(/\s+/g, " ")
      // 处理换行 - 保留段落结构
      .replace(/\n\s+/g, "\n")
      // 移除常见的网页噪声
      .replace(/评论\d+|点赞\d+|收藏\d+|分享\d+|举报/g, "")
      // 移除常见的版权信息和网站信息
      .replace(/版权所有|copyright|all rights reserved/gi, "")
      // 处理多余的换行符
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    // 移除文章开头的常见噪声
    cleanedText = cleanedText
      .replace(/^(导语|摘要|简介|前言|abstract|summary)[：:]\s*/i, "")
      .replace(/^(正文|内容|content)[：:]\s*/i, "")

    return cleanedText
  }
}
