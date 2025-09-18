import { Buffer } from "node:buffer"
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ImapFlow, ImapFlowOptions } from "imapflow"
import { Attachment, simpleParser } from "mailparser"
import { AwsService } from "@/common/aws/aws.service"
import {
  MAX_FILE_SIZE,
  SUPPORTED_FILE_EXTENSIONS,
} from "@/common/constants/file-types"
import { PrismaService } from "@/common/prisma/prisma.service"
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

  constructor(
    private readonly configService: ConfigService,
    private readonly awsService: AwsService,
    private readonly prismaService: PrismaService,
  ) {}

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

    this.logger.log("Starting to check for unseen emails...")
    const mailboxes = Object.values(this.MAILBOXES)

    for (const mailbox of mailboxes) {
      try {
        await this.handleUnseenEmail(mailbox)
      } catch (error) {
        this.logger.error(
          `Failed to handle unseen emails in ${mailbox}: ${error.message}`,
        )
      }
    }
    this.logger.log("Finished checking all mailboxes")
  }

  private async handleUnseenEmail(mailbox: string) {
    if (!this.client) {
      return
    }

    const lock = await this.client.getMailboxLock(mailbox)

    try {
      const unseenEmails = await this.client.search({ seen: false })
      if (unseenEmails && unseenEmails.length > 0) {
        this.logger.log(
          `Processing ${unseenEmails.length} unseen emails in ${mailbox}`,
        )
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

            // 处理完成后将邮件标记为已读
            await this.markEmailAsRead(
              message.uid,
              emailInfo.from?.address,
              mailbox,
            )
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

  private async handleEmailContent(emailInfo: EmailInfo) {
    const senderEmail = emailInfo.from?.address?.toLowerCase().trim()

    try {
      if (!senderEmail) {
        this.logger.warn("Email without sender address, skipping...")
        return
      }

      // 检查发件人邮箱是否在白名单中
      const whitelistEntry = await this.prismaService.emailWhitelist.findUnique(
        {
          where: { email: senderEmail },
        },
      )

      if (!whitelistEntry) {
        this.logger.warn(
          `Email from ${senderEmail} not in whitelist, skipping...`,
        )
        return
      }

      // 处理邮件附件
      if (emailInfo.attachments && emailInfo.attachments.length > 0) {
        this.logger.log(
          `Processing ${emailInfo.attachments.length} attachments from ${senderEmail}`,
        )
        await this.processEmailAttachments(emailInfo, senderEmail)
      }
    } catch (error) {
      this.logger.error(
        `Error processing email content: ${error.message}`,
        error.stack,
      )
    }
  }

  private async processEmailAttachments(
    emailInfo: EmailInfo,
    senderEmail: string,
  ) {
    if (!emailInfo.attachments) return

    for (const attachment of emailInfo.attachments) {
      try {
        // 过滤无效附件
        if (!attachment.content || !attachment.filename) {
          this.logger.warn(
            `Invalid attachment in email from ${senderEmail}, skipping...`,
          )
          continue
        }

        // 验证文件类型和大小
        if (!this.validateAttachment(attachment, senderEmail)) {
          continue
        }

        // 上传附件到 S3
        const storageFilename = await this.uploadAttachmentToS3(attachment)

        // 保存到待处理表
        await this.prismaService.pendingArchiveOrig.create({
          data: {
            senderEmail,
            messageId: emailInfo.messageId,
            subject: emailInfo.subject,
            originalFilename: attachment.filename,
            storageUrl: storageFilename,
            fileType:
              attachment.filename?.split(".").pop()?.toLowerCase() || "bin",
            status: "pending",
          },
        })

        this.logger.log(
          `Saved attachment ${attachment.filename} from ${senderEmail} to pending queue`,
        )
      } catch (error) {
        this.logger.error(
          `Error processing attachment ${attachment.filename} from ${senderEmail}: ${error.message}`,
          error.stack,
        )
      }
    }
  }

  /**
   * 验证邮件附件的类型和大小
   */
  private validateAttachment(
    attachment: Attachment,
    senderEmail: string,
  ): boolean {
    const filename = attachment.filename || ""
    const fileExtension = filename.split(".").pop()?.toLowerCase() || ""
    const fileSize = attachment.content?.length || 0

    // 检查文件大小
    if (fileSize > MAX_FILE_SIZE) {
      this.logger.warn(
        `Attachment ${filename} from ${senderEmail} exceeds size limit (${fileSize} > ${MAX_FILE_SIZE})`,
      )
      return false
    }

    // 检查文件扩展名
    const supportedExtensions = SUPPORTED_FILE_EXTENSIONS.map((ext) =>
      ext.toLowerCase(),
    )
    if (!supportedExtensions.includes(`.${fileExtension}`)) {
      this.logger.warn(
        `Unsupported file extension .${fileExtension} for ${filename} from ${senderEmail}`,
      )
      return false
    }

    return true
  }

  /**
   * 上传邮件附件到 S3
   */
  private async uploadAttachmentToS3(attachment: Attachment): Promise<string> {
    const timestamp = Date.now()
    const originalFilename = attachment.filename || "attachment"
    const storageFilename = `email_${timestamp}_${originalFilename}`

    const storagePath = await this.awsService.uploadPublicFile(
      this.configService.awsS3Directory,
      storageFilename,
      attachment.content,
    )

    return storagePath.replace(`${this.configService.awsS3Directory}/`, "")
  }

  /**
   * 将邮件标记为已读
   */
  private async markEmailAsRead(
    uid?: number,
    senderEmail?: string,
    mailbox?: string,
  ) {
    if (!this.client || !uid) {
      this.logger.warn("Cannot mark email as read: missing client or uid")
      return
    }

    try {
      // 注意：这里不需要重新获取锁，因为调用方已经持有了邮箱锁
      await this.client.messageFlagsAdd(uid, ["\\Seen"], { uid: true })
    } catch (error) {
      this.logger.error(
        `Failed to mark email as read (uid: ${uid}, sender: ${senderEmail}, mailbox: ${mailbox}): ${error.message}`,
      )
    }
  }

  private async handleReconnect(config: ImapFlowOptions) {
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
