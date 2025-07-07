import { ApiProperty } from "@nestjs/swagger"

export class Archive {
  @ApiProperty({
    description: "唯一ID",
    example: 1,
  })
  id: number

  @ApiProperty({
    description: "文档标题",
    example: "文档标题",
  })
  title: string

  @ApiProperty({
    description: "作者列表",
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        order: { type: "number" },
      },
    },
    example: [
      { id: 1, name: "张三", order: 1 },
      { id: 2, name: "李四", order: 2 },
    ],
  })
  authors: { id: number; name: string; order: number }[]

  @ApiProperty({
    description: "出版方",
    type: "object",
    properties: {
      id: { type: "number" },
      name: { type: "string" },
    },
    nullable: true,
    example: { id: 1, name: "某某出版社" },
  })
  publisher: { id: number; name: string } | null

  @ApiProperty({
    description: "日期",
    nullable: true,
    example: { id: 1, value: "2025-06-08" },
  })
  date: { id: number; value: string } | null

  @ApiProperty({
    description: "章节类别",
    example: "本纪",
  })
  chapter: string

  @ApiProperty({
    description: "标签列表",
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
    },
    nullable: true,
    example: [
      { id: 1, name: "标签1" },
      { id: 2, name: "标签2" },
    ],
  })
  tags: { id: number; name: string }[]

  @ApiProperty({
    description: "备注",
    nullable: true,
    example: "这是一条备注信息",
  })
  remarks: string | null

  @ApiProperty({
    description: "原始文件列表",
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "number" },
        originalUrl: { type: "string", nullable: true },
        storageUrl: { type: "string" },
        fileType: { type: "string", nullable: true },
        storageType: { type: "string" },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
      },
    },
    example: [
      {
        id: 1,
        originalUrl: "https://example.com/original",
        storageUrl: "file.html",
        fileType: "html",
        storageType: "s3",
        createdAt: "2025-06-08T09:35:48.917Z",
        updatedAt: "2025-06-08T09:35:48.917Z",
      },
    ],
  })
  origs: {
    id: number
    originalUrl: string | null
    storageUrl: string
    fileType: string | null
    storageType: string
    createdAt: Date
    updatedAt: Date
  }[]

  @ApiProperty({
    description: "点赞数",
    example: 0,
  })
  likes: number

  @ApiProperty({
    description: "创建时间",
    example: "2025-06-08T09:35:48.917Z",
  })
  createdAt: Date

  @ApiProperty({
    description: "更新时间",
    example: "2025-06-08T09:35:48.917Z",
  })
  updatedAt: Date
}
