import { Test, TestingModule } from "@nestjs/testing"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"

describe("appController", () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe("root", () => {
    it("returns the service welcome message", () => {
      expect(appController.getHello()).toBe("Welcome to lanting-backend!")
    })
  })
})
