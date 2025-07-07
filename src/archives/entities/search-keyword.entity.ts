import { ApiProperty } from "@nestjs/swagger"

export class SearchKeyword {
  @ApiProperty({
    description: "唯一ID",
    example: 1,
  })
  id: number

  @ApiProperty({
    description: "搜索关键词",
    example: "JavaScript",
  })
  keyword: string

  @ApiProperty({
    description: "搜索次数",
    example: 5,
  })
  searchCount: number

  @ApiProperty({
    description: "创建时间",
    example: "2025-07-07T02:30:00.000Z",
  })
  createdAt: Date

  @ApiProperty({
    description: "更新时间",
    example: "2025-07-07T02:30:00.000Z",
  })
  updatedAt: Date
}

/**
 * 搜索关键词响应实体（不包含时间字段）
 */
export class SearchKeywordResponse {
  @ApiProperty({
    description: "唯一ID",
    example: 1,
  })
  id: number

  @ApiProperty({
    description: "搜索关键词",
    example: "JavaScript",
  })
  keyword: string

  @ApiProperty({
    description: "搜索次数",
    example: 5,
  })
  searchCount: number
}
