import { CACHE_MANAGER } from "@nestjs/cache-manager"
import { BadRequestException } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import { PrismaService } from "../common/prisma/prisma.service"
import { ArchivesService } from "./archives.service"

// Mock the dependencies
const mockAwsService = {}
const mockConfigService = {}
const mockCacheManager = {}

describe("archivesService", () => {
  let service: ArchivesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchivesService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: "AwsService",
          useValue: mockAwsService,
        },
        {
          provide: "ConfigService",
          useValue: mockConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile()

    service = module.get<ArchivesService>(ArchivesService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("getAllValidChapters", () => {
    it("should return all valid chapters", () => {
      const chapters = service.getAllValidChapters()
      expect(chapters).toEqual([
        "本纪",
        "世家",
        "搜神",
        "列传",
        "游侠",
        "群像",
        "随园食单",
      ])
    })
  })

  describe("chapter validation", () => {
    it("should not throw error for valid chapter", () => {
      expect(() => {
        // Access the private method for testing
        ;(service as any).validateChapter("本纪")
      }).not.toThrow()
    })

    it("should throw BadRequestException for invalid chapter", () => {
      expect(() => {
        ;(service as any).validateChapter("invalid_chapter")
      }).toThrow(BadRequestException)
    })

    it("should not throw error when chapter is undefined", () => {
      expect(() => {
        ;(service as any).validateChapter(undefined)
      }).not.toThrow()
    })
  })
})
