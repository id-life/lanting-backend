import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { User } from "@prisma/client"
import { CurrentUser } from "@/auth/decorators/user.decorator"
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard"
import { UpdateWhitelistDto } from "./dto/update-whitelist.dto"
import { EmailService } from "./email.service"

@ApiTags("Email")
@Controller("email")
@UseGuards(JwtAuthGuard)
export class EmailController {
  private readonly logger = new Logger(EmailController.name)

  constructor(private readonly emailService: EmailService) {}

  @Get("whitelist")
  @ApiOperation({ summary: "Get current user's email whitelist" })
  @ApiResponse({
    status: 200,
    description: "Email whitelist retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  email: { type: "string" },
                },
              },
            },
          },
        },
        message: {
          type: "string",
          example: "Email whitelist retrieved successfully",
        },
      },
    },
  })
  async getWhitelist(@CurrentUser() user: User) {
    try {
      const emails = await this.emailService.getUserWhitelist(user.id)
      return {
        success: true,
        data: { emails },
        message: "Email whitelist retrieved successfully",
      }
    } catch (error) {
      this.logger.error(
        `Failed to get email whitelist of user ${user.id}`,
        error,
      )
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: "Failed to retrieve email whitelist",
      })
    }
  }

  @Post("whitelist")
  @ApiOperation({ summary: "Update current user's email whitelist" })
  @ApiBody({ type: UpdateWhitelistDto })
  @ApiResponse({
    status: 200,
    description: "Email whitelist updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  email: { type: "string" },
                },
              },
            },
          },
        },
        message: {
          type: "string",
          example: "Email whitelist updated successfully",
        },
      },
    },
  })
  async updateWhitelist(
    @CurrentUser() user: User,
    @Body() updateWhitelistDto: UpdateWhitelistDto,
  ) {
    try {
      const emails = await this.emailService.updateUserWhitelist(
        user.id,
        updateWhitelistDto.emails,
      )
      return {
        success: true,
        data: { emails },
        message: "Email whitelist updated successfully",
      }
    } catch {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: "Failed to update email whitelist",
      })
    }
  }
}
