import process from "node:process"
import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { PassportModule } from "@nestjs/passport"
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { LocalStrategy } from "./local.strategy"
import { GitHubStrategy } from "./strategies/github.strategy"
import { JwtStrategy } from "./strategies/jwt.strategy"

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: "7d",
        issuer: "lanting-api", // 签发者
        audience: "lanting-client", // 受众
      },
      verifyOptions: {
        issuer: "lanting-api",
        audience: "lanting-client",
      },
    }),
  ],
  providers: [AuthService, GitHubStrategy, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
