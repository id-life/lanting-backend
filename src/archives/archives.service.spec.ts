import { Test, TestingModule } from "@nestjs/testing"
import { ArchivesService } from "./archives.service"

describe("archivesService", () => {
  let service: ArchivesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArchivesService],
    }).compile()

    service = module.get<ArchivesService>(ArchivesService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })
})
