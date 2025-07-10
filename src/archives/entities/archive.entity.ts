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
      },
    },
    example: [
      { id: 1, name: "张三" },
      { id: 2, name: "李四" },
    ],
  })
  authors: { id: number; name: string }[]

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
      },
    },
    example: [
      {
        id: 1,
        originalUrl: "https://example.com/original",
        storageUrl: "file.html",
        fileType: "html",
        storageType: "s3",
      },
    ],
  })
  origs: {
    id: number
    originalUrl: string | null
    storageUrl: string
    fileType: string | null
    storageType: string
  }[]

  @ApiProperty({
    description: "点赞数",
    example: 0,
  })
  likes: number

  // 注意：createdAt 和 updatedAt 字段在 API 响应中不会返回
  // 这些字段在 transformArchiveData 方法中被排除了
}
