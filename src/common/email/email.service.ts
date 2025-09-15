import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ImapFlow } from "imapflow"
import { ConfigService } from "@/config/config.service"

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name)
  private client: ImapFlow | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 3
  private reconnectInterval = 5000 // 5 seconds

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log("EmailService initializing...")
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
    }

    // 验证配置是否完整
    if (!config.host || !config.auth.user || !config.auth.pass) {
      this.logger.warn(
        "Email configuration incomplete, skipping initialization",
      )
      return
    }

    await this.connectWithRetry(config)
  }

  private async connectWithRetry(config: any) {
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
    } catch (error) {
      this.logger.error("Failed to connect to email server", error)
      await this.handleReconnect(config)
    }
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
