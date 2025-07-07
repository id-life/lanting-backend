import { ApiProperty, PartialType } from "@nestjs/swagger"
import { CreateArchiveDto } from "./create-archive.dto"

export class UpdateArchiveDto extends PartialType(CreateArchiveDto) {
  @ApiProperty({
    description: "文档标题",
    example: "文档标题",
    required: false,
  })
  title?: string

  @ApiProperty({
    description: "作者列表",
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
    required: false,
    example: "本纪",
    enum: ["本纪", "世家", "搜神", "列传", "游侠", "群像", "随园食单"],
  })
  chapter?: string

  @ApiProperty({
    description: "标签列表",
    type: [String],
    required: false,
    example: ["标签1", "标签2"],
  })
  tag?: string[]

  @ApiProperty({
    description: "备注",
    required: false,
    example: "这是一条备注信息",
  })
  remarks?: string

  @ApiProperty({
    description: "原始URL",
    required: false,
    example: "https://example.com/original",
  })
  originalUrl?: string
}
