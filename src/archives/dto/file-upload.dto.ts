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
      "文件原始URL列表（可选）。支持灵活的混合模式：按索引位置与files数组对应，每个位置可以是：1) 仅URL（系统抓取） 2) 仅文件上传 3) 文件+URL（备份模式）。空字符串表示该位置无URL。",
    type: "array",
    items: {
      type: "string",
    },
    required: false,
    example: [
      "https://example.com/online-only", // 位置0: 仅URL抓取
      "https://example.com/with-backup", // 位置1: 文件+URL备份
      "", // 位置2: 仅文件上传
      "https://example.com/another-url", // 位置3: 仅URL抓取
    ],
  })
  originalUrls?: string[]
}
