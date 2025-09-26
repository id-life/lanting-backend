import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { User } from "@prisma/client"
import { CurrentUser } from "@/auth/decorators/user.decorator"
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard"
import { AddEmailDto } from "./dto/add-email.dto"
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
  @ApiOperation({ summary: "Add email to current user's whitelist" })
  @ApiBody({ type: AddEmailDto })
  @ApiResponse({
    status: 201,
    description: "Email added to whitelist successfully",
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
          example: "Email added to whitelist successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "Email already in use by another user",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null" },
        message: {
          type: "string",
          example: "Email address is already in use by another user",
        },
      },
    },
  })
  async addEmailToWhitelist(
    @CurrentUser() user: User,
    @Body() addEmailDto: AddEmailDto,
  ) {
    try {
      await this.emailService.addEmailToWhitelist(user.id, addEmailDto.email)
      // 添加成功后，返回完整的白名单
      const emails = await this.emailService.getUserWhitelist(user.id)
      return {
        success: true,
        data: { emails },
        message: "Email added to whitelist successfully",
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException({
          success: false,
          data: null,
          message: error.message,
        })
      }
      this.logger.error(
        `Failed to add email to whitelist for user ${user.id}`,
        error,
      )
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: "Failed to add email to whitelist",
      })
    }
  }

  @Delete("whitelist/:id")
  @ApiOperation({ summary: "Remove email from current user's whitelist" })
  @ApiParam({
    name: "id",
    description: "Email whitelist entry ID",
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Email removed from whitelist successfully",
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
          example: "Email removed from whitelist successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Email not found in user's whitelist",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        data: { type: "null" },
        message: {
          type: "string",
          example: "Email not found in your whitelist",
        },
      },
    },
  })
  async removeEmailFromWhitelist(
    @CurrentUser() user: User,
    @Param("id", ParseIntPipe) emailId: number,
  ) {
    try {
      await this.emailService.removeEmailFromWhitelist(user.id, emailId)
      // 删除成功后，返回完整的白名单
      const emails = await this.emailService.getUserWhitelist(user.id)
      return {
        success: true,
        data: { emails },
        message: "Email removed from whitelist successfully",
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: error.message,
        })
      }
      this.logger.error(
        `Failed to remove email from whitelist for user ${user.id}`,
        error,
      )
      throw new InternalServerErrorException({
        success: false,
        data: null,
        message: "Failed to remove email from whitelist",
      })
    }
  }
}
