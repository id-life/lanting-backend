import { ApiProperty } from "@nestjs/swagger"

export class Comment {
  @ApiProperty({
    description: "评论唯一ID",
    example: 1,
  })
  id: number

  @ApiProperty({
    description: "评论者昵称",
    example: "张三",
  })
  nickname: string

  @ApiProperty({
    description: "评论内容",
    example: "这是一个很好的归档！内容很有价值，感谢分享。",
  })
  content: string

  @ApiProperty({
    description: "归档ID",
    example: 123,
  })
  archiveId: number

  @ApiProperty({
    description: "创建时间",
    example: "2025-06-16T02:30:00.000Z",
  })
  createdAt: Date

  @ApiProperty({
    description: "更新时间",
    example: "2025-06-16T02:30:00.000Z",
  })
  updatedAt: Date
}
