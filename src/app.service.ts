import { Injectable } from "@nestjs/common"

@Injectable()
export class AppService {
  getHello(): string {
    return "Welcome to lanting-backend!"
  }

  getHealth() {
    return {
      status: "ok",
      message: "Service is running.",
    }
  }
}
