import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean } from "class-validator"

export class LikeArchiveDto {
  @ApiProperty({
    description: "点赞状态，true 为点赞，false 为取消点赞",
    example: true,
  })
  @IsBoolean()
  liked: boolean
}
