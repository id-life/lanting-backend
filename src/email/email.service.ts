import { Injectable } from "@nestjs/common"
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

  async updateUserWhitelist(userId: string, newEmails: string[]) {
    // 使用事务确保数据一致性
    return await this.prisma.$transaction(async (tx) => {
      // 获取现有邮箱
      const existingEmails = await tx.emailWhitelist.findMany({
        where: { userId },
        select: { email: true },
      })

      const existingEmailSet = new Set(existingEmails.map((e) => e.email))
      const newEmailSet = new Set(newEmails)

      // 找出要删除的邮箱
      const toDelete = existingEmails
        .filter((e) => !newEmailSet.has(e.email))
        .map((e) => e.email)

      // 找出要添加的邮箱
      const toAdd = newEmails.filter((email) => !existingEmailSet.has(email))

      // 删除不需要的邮箱
      if (toDelete.length > 0) {
        await tx.emailWhitelist.deleteMany({
          where: {
            userId,
            email: { in: toDelete },
          },
        })
      }

      // 添加新的邮箱
      if (toAdd.length > 0) {
        await tx.emailWhitelist.createMany({
          data: toAdd.map((email) => ({ userId, email })),
        })
      }

      // 返回更新后的白名单
      return await tx.emailWhitelist.findMany({
        where: { userId },
        select: {
          id: true,
          email: true,
        },
        orderBy: { createdAt: "asc" },
      })
    })
  }
}
