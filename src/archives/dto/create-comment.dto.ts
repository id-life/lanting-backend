import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsString, MaxLength } from "class-validator"

export class CreateCommentDto {
  @ApiProperty({
    description: "评论者昵称",
    example: "张三",
    maxLength: 50,
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  nickname: string

  @ApiProperty({
    description: "评论内容",
    example: "这是一个很好的归档！内容很有价值，感谢分享。",
    maxLength: 1000,
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  content: string
}
