import { Test, TestingModule } from "@nestjs/testing"
import { TributeService } from "./tribute.service"

describe("tributeService", () => {
  let service: TributeService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TributeService],
    }).compile()

    service = module.get<TributeService>(TributeService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })
})
