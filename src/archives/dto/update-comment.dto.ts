import { PartialType } from "@nestjs/mapped-types"
import { ApiProperty } from "@nestjs/swagger"
import { IsOptional, IsString, MaxLength } from "class-validator"
import { CreateCommentDto } from "./create-comment.dto"

export class UpdateCommentDto extends PartialType(CreateCommentDto) {
  @ApiProperty({
    description: "评论者昵称",
    example: "张三",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string

  @ApiProperty({
    description: "评论内容",
    example: "这是一个很好的归档！内容很有价值，感谢分享。",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string
}
