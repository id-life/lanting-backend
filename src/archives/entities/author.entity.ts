import { ApiProperty } from "@nestjs/swagger"

export class Author {
  @ApiProperty({
    description: "作者唯一ID",
    example: 1,
  })
  id: number

  @ApiProperty({
    description: "作者姓名",
    example: "张三",
  })
  name: string

  @ApiProperty({
    description: "创建时间",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date

  @ApiProperty({
    description: "更新时间",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt: Date
}
