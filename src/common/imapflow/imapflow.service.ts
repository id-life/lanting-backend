import { Buffer } from "node:buffer"
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ImapFlow, ImapFlowOptions } from "imapflow"
import { Attachment, simpleParser } from "mailparser"
import { ConfigService } from "@/config/config.service"

interface EmailInfo {
  messageId?: string
  subject?: string
  from: {
    name?: string
    address?: string
  }
  date?: Date
  text?: string
  html?: string | false
  attachments?: Attachment[]
}

@Injectable()
export class ImapflowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapflowService.name)
  private client: ImapFlow | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 3
  private reconnectInterval = 5000 // 5 seconds
  private MAILBOXES = {
    INBOX: "INBOX",
    SPAM: "垃圾邮件",
  }

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log("ImapflowService initializing...")
    await this.initializeEmail()
  }

  async onModuleDestroy() {
    await this.disconnect()
  }

  private async initializeEmail() {
    const config = {
      host: this.configService.emailHost || "",
      port: this.configService.emailPort || 993,
      secure: true,
      auth: {
        user: this.configService.emailUsername || "",
        pass: this.configService.emailPassword || "",
      },
      logger: false,
    } satisfies ImapFlowOptions

    // 验证配置是否完整
    if (!config.host || !config.auth.user || !config.auth.pass) {
      this.logger.warn(
        "Email configuration incomplete, skipping initialization",
      )
      return
    }

    await this.connectWithRetry(config)
  }

  private async connectWithRetry(config: ImapFlowOptions) {
    try {
      this.client = new ImapFlow(config)

      // 设置连接事件监听
      this.client.on("close", () => {
        this.logger.warn("Email connection closed, attempting to reconnect...")
        this.handleReconnect(config)
      })

      this.client.on("error", (error) => {
        this.logger.error("Email connection error:", error)
        this.handleReconnect(config)
      })

      await this.client.connect()
      this.logger.log("Connected to email server")
      this.reconnectAttempts = 0 // 重置重连计数器

      await this.handleUnseenEmails()
    } catch (error) {
      this.logger.error("Failed to connect to email server", error)
      await this.handleReconnect(config)
    }
  }

  private async handleUnseenEmails() {
    if (!this.client) {
      return
    }

    const lock = await this.client.getMailboxLock(this.MAILBOXES.INBOX)

    try {
      const unseenEmails = await this.client.search({ seen: false })
      if (unseenEmails && unseenEmails.length > 0) {
        const messages = await this.client?.fetchAll(unseenEmails, {
          envelope: true,
          source: true,
        })

        for (const message of messages) {
          const source = message.source

          if (source) {
            // 使用 mailparser 解析邮件
            const emailInfo = await this.processEmail(source)
            await this.handleEmailContent(emailInfo)
          }
        }
      }
    } finally {
      lock?.release()
    }
  }

  private async processEmail(
    buffer: Buffer<ArrayBufferLike>,
  ): Promise<EmailInfo> {
    const parsedEmail = await simpleParser(buffer)

    // 提取邮件基本信息
    const emailInfo: EmailInfo = {
      messageId: parsedEmail.messageId,
      subject: parsedEmail.subject,
      from: {
        name: parsedEmail.from?.text,
        address: parsedEmail.from?.value?.[0]?.address,
      },
      date: parsedEmail.date,
      text: parsedEmail.text,
      html: parsedEmail.html,
      attachments: parsedEmail.attachments,
    }

    return emailInfo
  }

  private async handleEmailContent(_emailInfo: EmailInfo) {
    // 处理邮件内容的业务逻辑
  }

  private async handleReconnect(config: any) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) reached, giving up`,
      )
      return
    }

    this.reconnectAttempts++
    this.logger.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectInterval}ms`,
    )

    setTimeout(async () => {
      await this.connectWithRetry(config)
    }, this.reconnectInterval)

    // 指数退避：每次重连间隔增加
    this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, 30000) // 最大30秒
  }

  private async disconnect() {
    if (this.client) {
      try {
        await this.client.logout()
        this.client = null
        this.logger.log("Disconnected from email server")
      } catch (error) {
        this.logger.error("Error disconnecting from email server", error)
      }
    }
  }
}
