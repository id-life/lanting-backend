import { ImapflowService } from "./imapflow.service"

describe("ImapflowService migration gate", () => {
  function create(enabled: boolean) {
    const config = { emailWorkerEnabled: enabled }
    return new ImapflowService(config as any, {} as any, {} as any)
  }

  it("does not initialize email or scheduled work in web slots", async () => {
    const service = create(false)
    const initialize = jest
      .spyOn(service as any, "initializeEmail")
      .mockResolvedValue(undefined)

    await service.onModuleInit()
    await service.checkSpamEmails()

    expect(initialize).not.toHaveBeenCalled()
  })

  it("initializes email only for the explicitly enabled worker", async () => {
    const service = create(true)
    const initialize = jest
      .spyOn(service as any, "initializeEmail")
      .mockResolvedValue(undefined)

    await service.onModuleInit()

    expect(initialize).toHaveBeenCalledTimes(1)
  })
})
