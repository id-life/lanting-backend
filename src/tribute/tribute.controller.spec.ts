import { Test, TestingModule } from "@nestjs/testing"
import { TributeController } from "./tribute.controller"
import { TributeService } from "./tribute.service"

describe("tributeController", () => {
  let controller: TributeController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TributeController],
      providers: [TributeService],
    }).compile()

    controller = module.get<TributeController>(TributeController)
  })

  it("should be defined", () => {
    expect(controller).toBeDefined()
  })
})
