import { Test, TestingModule } from "@nestjs/testing"
import { ArchivesController } from "./archives.controller"
import { ArchivesService } from "./archives.service"

describe("archivesController", () => {
  let controller: ArchivesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArchivesController],
      providers: [ArchivesService],
    }).compile()

    controller = module.get<ArchivesController>(ArchivesController)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })
})
