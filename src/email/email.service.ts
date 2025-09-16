import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "@/common/prisma/prisma.service"

@Injectable()
export class EmailService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserWhitelist(userId: string) {
    return await this.prisma.emailWhitelist.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async addEmailToWhitelist(userId: string, email: string) {
    try {
      const newEmail = await this.prisma.emailWhitelist.create({
        data: { userId, email },
        select: {
          id: true,
          email: true,
        },
      })
      return newEmail
    } catch (error) {
      // Prisma unique constraint violation
      if (error.code === "P2002") {
        throw new ConflictException(
          "Email address is already in use by another user",
        )
      }
      throw error
    }
  }

  async removeEmailFromWhitelist(userId: string, emailId: number) {
    // 验证邮箱是否属于当前用户
    const emailRecord = await this.prisma.emailWhitelist.findFirst({
      where: { id: emailId, userId },
    })

    if (!emailRecord) {
      throw new NotFoundException("Email not found in your whitelist")
    }

    await this.prisma.emailWhitelist.delete({
      where: { id: emailId },
    })
  }
}
