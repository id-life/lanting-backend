import { ConflictException, Injectable } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { User } from "@prisma/client"
import { PrismaService } from "@/common/prisma/prisma.service"

interface GitHubUser {
  githubId: string
  username: string
  email?: string
  avatar?: string
  name?: string
}

interface CreateUserDto {
  username: string
  email?: string
  password: string
  name?: string
}

export interface UpdateUserDto {
  githubId?: string
  username?: string
  email?: string
  name?: string
  avatar?: string
  githubSecret?: string
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateGithubUser(githubUser: GitHubUser): Promise<User> {
    const { githubId, username, email, avatar, name } = githubUser

    let user = await this.prisma.user.findUnique({
      where: { githubId },
    })

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          githubId,
          username,
          email,
          avatar,
          name,
        },
      })

      // 初始化邮件白名单
      if (email) {
        await this.prisma.emailWhitelist.create({
          data: {
            userId: user.id,
            email,
          },
        })
      }
    } else {
      const originalEmail = user.email

      user = await this.prisma.user.update({
        where: { githubId },
        data: {
          username,
          email,
          avatar,
          name,
        },
      })

      // 只有当邮箱发生变化时才检查并添加到白名单
      if (email && email !== originalEmail) {
        await this.prisma.emailWhitelist.upsert({
          where: {
            userId_email: {
              userId: user.id,
              email,
            },
          },
          update: {},
          create: {
            userId: user.id,
            email,
          },
        })
      }
    }

    return user
  }

  async validateUser(userId: string): Promise<Partial<User> | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        name: true,
        githubId: true,
        githubSecret: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async login(user: User) {
    const payload = { username: user.username, sub: user.id }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        name: user.name,
      },
    }
  }

  async validateLocalUser(
    username: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    })

    if (!user || !user.password) {
      return null
    }

    // const isPasswordValid = await bcrypt.compare(password, user.password);
    const isPasswordValid = password === user.password
    if (!isPasswordValid) {
      return null
    }

    return user
  }

  async register(createUserDto: CreateUserDto): Promise<User> {
    const { username, email, password, name } = createUserDto

    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      throw new ConflictException("Username already exists")
    }

    // const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password,
        name,
      },
    })

    // 初始化邮件白名单
    if (email) {
      await this.prisma.emailWhitelist.create({
        data: {
          userId: user.id,
          email,
        },
      })
    }

    return user
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const { username, email, name, avatar, githubId, githubSecret } =
      updateUserDto

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        username,
        email,
        name,
        avatar,
        githubId,
        githubSecret,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatar: true,
        githubId: true,
        githubSecret: true,
      },
    })

    return user
  }
}
