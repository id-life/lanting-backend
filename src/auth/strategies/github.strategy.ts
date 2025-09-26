import process from "node:process"
import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-github2"
import { AuthService } from "../auth.service"

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL!,
      scope: ["user:email"],
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    const { id, username, emails, photos, displayName } = profile

    const user = await this.authService.validateGithubUser({
      githubId: id,
      username,
      email: emails?.[0]?.value,
      avatar: photos?.[0]?.value,
      name: displayName,
    })

    return user
  }
}
