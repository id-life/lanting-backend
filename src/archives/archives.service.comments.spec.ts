import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { Test, TestingModule } from "@nestjs/testing"
import { AwsService } from "@/common/aws/aws.service"
import { ConfigService } from "@/config/config.service"
import { PrismaService } from "../common/prisma/prisma.service"
import { ArchivesService } from "./archives.service"
import { CreateCommentDto } from "./dto/create-comment.dto"

describe("archivesService - comments", () => {
  let service: ArchivesService
  let prismaService: PrismaService
  let cacheManager: any

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivesService,
        {
          provide: PrismaService,
          useValue: {
            comment: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            archive: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AwsService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<ArchivesService>(ArchivesService)
    prismaService = module.get<PrismaService>(PrismaService)
    cacheManager = module.get(CACHE_MANAGER)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("createComment", () => {
    it("should create a comment for an archive", async () => {
      const archiveId = 1
      const createCommentDto: CreateCommentDto = {
        nickname: "测试用户",
        content: "这是一条测试评论",
      }

      const mockArchive = { id: archiveId, title: "测试归档" }
      const mockComment = {
        id: 1,
        nickname: createCommentDto.nickname,
        content: createCommentDto.content,
        archiveId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock archive exists
      cacheManager.get.mockResolvedValue(null)
      ;(prismaService.archive.findUnique as jest.Mock).mockResolvedValue(
        mockArchive,
      )

      // Mock comment creation
      ;(prismaService.comment.create as jest.Mock).mockResolvedValue(
        mockComment,
      )
      cacheManager.set.mockResolvedValue(undefined)
      cacheManager.del.mockResolvedValue(undefined)

      const result = await service.createComment(archiveId, createCommentDto)

      expect(result).toEqual({
        success: true,
        data: mockComment,
        message: "Comment created successfully",
      })
      expect(prismaService.comment.create).toHaveBeenCalledWith({
        data: {
          ...createCommentDto,
          archiveId,
        },
      })
    })
  })

  describe("getCommentsByArchive", () => {
    it("should return comments for an archive", async () => {
      const archiveId = 1
      const mockArchive = { id: archiveId, title: "测试归档" }
      const mockComments = [
        {
          id: 1,
          nickname: "用户1",
          content: "评论1",
          archiveId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          nickname: "用户2",
          content: "评论2",
          archiveId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // Mock archive exists
      cacheManager.get.mockResolvedValueOnce(null) // For findOne cache
      ;(prismaService.archive.findUnique as jest.Mock).mockResolvedValue(
        mockArchive,
      )
      cacheManager.set.mockResolvedValue(undefined)

      // Mock comments retrieval
      cacheManager.get.mockResolvedValueOnce(null) // For comments cache
      ;(prismaService.comment.findMany as jest.Mock).mockResolvedValue(
        mockComments,
      )

      const result = await service.getCommentsByArchive(archiveId)

      expect(result).toEqual({
        success: true,
        count: mockComments.length,
        data: mockComments,
      })
      expect(prismaService.comment.findMany).toHaveBeenCalledWith({
        where: { archiveId },
        orderBy: { createdAt: "desc" },
      })
    })
  })
})
