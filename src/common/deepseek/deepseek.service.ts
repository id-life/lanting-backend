import { Injectable, Logger } from "@nestjs/common"
import OpenAI from "openai"
import { ConfigService } from "@/config/config.service"

export interface DeepSeekHighlight {
  type: string
  content: string
  reason: string
}

export interface DeepSeekAnalysisResult {
  summary: string
  highlights: DeepSeekHighlight[]
  keywords: {
    predefined: string[]
    extracted: string[]
  }
}

@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name)
  private readonly client: OpenAI
  private readonly model: string
  private readonly maxTokens: number = 10000

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.deepSeekApiKey
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured")
    }

    this.model = this.configService.deepSeekModelName
    this.client = new OpenAI({
      baseURL: "https://api.ppinfra.com/v3/openai",
      apiKey,
      timeout: 240_000,
      maxRetries: 3,
    })
  }

  /**
   * 分析文章内容，生成摘要和提取关键词
   * @param title 文章标题
   * @param content 文章内容
   * @param maxKeywords 最大关键词数量
   * @returns 分析结果
   */
  async analyzeContent(
    title: string,
    content: string,
    maxKeywords: number = 15,
  ): Promise<DeepSeekAnalysisResult> {
    try {
      const prompt = `
请分析以下文章内容，并完成以下任务：

1. 生成一个简洁的摘要（不超过200字）
2. 请从文章中摘录3-5个你认为最具特色和意义、最让人印象深刻、最有趣、最值得关注的精彩段落，类型包括：
   - 核心观点
   - 重要数据
   - 典型案例  
   - 有趣内容
   - 精彩金句
3. 提取${maxKeywords}个关键词

文章标题：${title}
文章内容：${content}

请以JSON格式返回结果，格式如下：
{
  "summary": "文章摘要",
  "highlights": [
    {
      "type": "核心观点/重要数据/典型案例/有趣内容/精彩金句",
      "content": "精华内容（如果是精彩金句类型则为原文金句+适当背景说明，其他类型为50-300字详细内容，包含完整的背景、观点、论证或案例细节）", 
      "reason": "清晰具体地说明你选择这个段落的理由：它如何体现文章的核心思想和独特之处，有什么重要性与影响，这段内容的价值是什么、能解决什么问题、提供什么新认知、有什么实用性或启发性。避免空洞的赞美词汇（30-150字）"
    }
  ],
  "keywords": {
    "extracted": ["关键词1", "关键词2", ...]
  }
}

注意：请确保你的摘录和理由具体、清晰，以便他人能理解其重要性与影响。highlights数组中应该包含文章最精华、最能代表文章核心价值的内容，按重要性排序。对于"精彩金句"类型，content应包含原文的精确引用加上必要的背景说明；对于其他类型，content字段必须是多句话的详细描述，包含背景、核心内容、具体细节，让读者不看原文也能完全理解这个观点或信息。reason字段要说明实际价值和应用场景，不要写"很有启发性"、"值得思考"等空话套话。
`

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的文章分析助手，擅长提取文章精华内容和生成摘要。请确保返回的结果是有效的JSON格式。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3,
      })

      const result = this.parseResponse(response.choices[0].message.content)
      return result
    } catch (error) {
      throw new Error(`文章分析失败，请稍后重试: ${error.message}`)
    }
  }

  /**
   * 解析 API 响应
   * @param response API 返回的文本
   * @returns 解析后的结果
   */
  private parseResponse(response: string | null): DeepSeekAnalysisResult {
    if (!response) {
      throw new Error("API 返回为空")
    }

    try {
      // 尝试直接解析 JSON
      const result = JSON.parse(response)
      return {
        summary: result.summary || "",
        highlights: result.highlights || [],
        keywords: {
          predefined: [],
          extracted: result.keywords?.extracted || [],
        },
      }
    } catch {
      // 如果直接解析失败，尝试提取 JSON 部分
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0])
          return {
            summary: result.summary || "",
            highlights: result.highlights || [],
            keywords: {
              predefined: [],
              extracted: result.keywords?.extracted || [],
            },
          }
        } catch (e) {
          this.logger.error("JSON parse error:", e)
        }
      }

      // 如果还是失败，返回默认值
      return {
        summary: "",
        highlights: [],
        keywords: {
          predefined: [],
          extracted: [],
        },
      }
    }
  }
}
