import { ApiProperty } from "@nestjs/swagger"
import { ArchiveChapter } from "~/generated/prisma"

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
    description: "作者",
    nullable: true,
    example: "张三",
  })
  author: string | null

  @ApiProperty({
    description: "出版方",
    nullable: true,
    example: "某某出版社",
  })
  publisher: string | null

  @ApiProperty({
    description: "日期",
    nullable: true,
    example: "2025-06-08",
  })
  date: string | null

  @ApiProperty({
    description: "章节类别",
    enum: ArchiveChapter,
    nullable: true,
    example: "本纪",
  })
  chapter: ArchiveChapter | null

  @ApiProperty({
    description: "标签列表",
    type: "array",
    items: { type: "string" },
    nullable: true,
    example: ["标签1", "标签2"],
  })
  tag: any | null // prisma JSON

  @ApiProperty({
    description: "备注",
    nullable: true,
    example: "这是一条备注信息",
  })
  remarks: string | null

  @ApiProperty({
    description: "原始URL",
    nullable: true,
    example: "https://example.com/original",
  })
  originalUrl: string | null

  @ApiProperty({
    description: "归档文件名",
    nullable: true,
    example: "hash.html",
  })
  archiveFilename: string | null

  @ApiProperty({
    description: "文件类型",
    nullable: true,
    example: "html",
  })
  fileType: string | null

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
