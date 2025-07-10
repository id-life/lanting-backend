import { Controller, Get } from "@nestjs/common"
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { AppService } from "./app.service"

@ApiTags("app")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "获取应用欢迎信息" })
  @ApiResponse({
    status: 200,
    description: "返回应用欢迎信息",
    schema: {
      type: "string",
      example: "Welcome to lanting-backend!",
    },
  })
  getHello(): string {
    return this.appService.getHello()
  }

  @Get("health")
  @ApiOperation({ summary: "健康检查" })
  @ApiResponse({
    status: 200,
    description: "返回服务健康状态",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        message: { type: "string", example: "Service is running." },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth()
  }
}
