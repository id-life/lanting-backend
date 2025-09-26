import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { Request, Response } from "express"
import { ConfigService } from "@/config/config.service"
import { AuthService, UpdateUserDto } from "./auth.service"

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get("github")
  @UseGuards(AuthGuard("github"))
  @ApiOperation({ summary: "Initiate GitHub OAuth login" })
  @ApiResponse({ status: 302, description: "Redirects to GitHub OAuth" })
  async githubLogin() {
    // Guard redirects to GitHub
  }

  @Get("github/callback")
  @UseGuards(AuthGuard("github"))
  @ApiOperation({ summary: "GitHub OAuth callback" })
  @ApiResponse({ status: 302, description: "Redirects to frontend with token" })
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any
    const result = await this.authService.login(user)

    // Redirect to frontend with token
    const redirectUrl = `${
      this.configService.frontendUrl || "http://localhost:3000"
    }?token=${result.access_token}`
    return res.redirect(redirectUrl)
  }

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        username: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
        name: { type: "string" },
      },
      required: ["username", "password"],
    },
  })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 409, description: "Username already exists" })
  async register(@Body() createUserDto: any) {
    const user = await this.authService.register(createUserDto)
    return this.authService.login(user)
  }

  @Post("login")
  @UseGuards(AuthGuard("local"))
  @ApiOperation({ summary: "Login with username and password" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "password"],
    },
  })
  @ApiResponse({ status: 200, description: "Login successful" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Req() req: Request) {
    return this.authService.login(req.user as any)
  }

  @Get("profile")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Returns user profile" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Req() req: Request) {
    return req.user
  }

  // 修改profile
  @Post("profile-update")
  @UseGuards(AuthGuard("jwt"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user profile" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        username: { type: "string" },
        email: { type: "string" },
        name: { type: "string" },
        avatar: { type: "string" },
        githubId: { type: "string" },
        githubSecret: { type: "string" },
      },
    },
  })
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.authService.updateProfile((req.user as any).id, updateUserDto)
  }
}
