import { ApiProperty } from "@nestjs/swagger"

export class ArchiveFileUploadDto {
  @ApiProperty({
    description: "文档标题",
    example: "文档标题",
  })
  title: string

  @ApiProperty({
    description: "作者列表（支持多个作者，用逗号分隔）",
    required: false,
    type: "array",
    items: {
      type: "string",
    },
    example: ["张三", "李四"],
  })
  authors?: string[]

  @ApiProperty({
    description: "出版方",
    required: false,
    example: "某某出版社",
  })
  publisher?: string

  @ApiProperty({
    description: "日期",
    required: false,
    example: "2025-06-08",
  })
  date?: string

  @ApiProperty({
    description: "章节类别",
    required: true,
    example: "本纪",
    enum: ["本纪", "世家", "搜神", "列传", "游侠", "群像", "随园食单"],
  })
  chapter: string

  @ApiProperty({
    description: "标签列表（支持多个标签，用逗号分隔）",
    type: [String],
    required: false,
    example: ["标签1", "标签2"],
  })
  tags?: string[]

  @ApiProperty({
    description: "备注",
    required: false,
    example: "这是一条备注信息",
  })
  remarks?: string

  @ApiProperty({
    description:
      "归档文件列表（支持多文件上传，最多10个文件）。可以与originalUrls数组配合使用，实现文件与原始URL的对应关系。",
    type: "array",
    items: {
      type: "string",
      format: "binary",
    },
    required: false,
  })
  files?: Express.Multer.File[]

  @ApiProperty({
    description:
      "文件原始URL列表（可选）。与files数组按索引一一对应，originalUrls[0]对应files[0]。支持混合模式：数组中可以包含空字符串表示对应文件无原始URL。如果不上传文件，可以仅提供此数组让系统抓取URL内容。",
    type: "array",
    items: {
      type: "string",
    },
    required: false,
    example: [
      "https://example.com/source1.html",
      "", // 第二个文件没有原始URL
      "https://example.com/source3.pdf",
    ],
  })
  originalUrls?: string[]
}
