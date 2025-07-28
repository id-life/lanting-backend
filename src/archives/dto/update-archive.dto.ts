import { ApiHideProperty, ApiProperty, PartialType } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsArray, IsOptional, IsString } from "class-validator"
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
  tags?: string[]

  @ApiProperty({
    description: "备注",
    required: false,
    example: "这是一条备注信息",
  })
  remarks?: string

  @ApiProperty({
    description:
      "文件原始URL列表（可选）。与files数组按索引对应，每个位置可以是：1) URL（从网络抓取内容，优先级最高） 2) 空字符串（该位置使用files中的内容）。注意：如果提供了URL，将优先从URL抓取内容，忽略files中对应位置的内容。",
    required: false,
    type: "array",
    items: {
      type: "string",
    },
    example: [
      "https://example.com/web-content.html", // 位置0: 从URL抓取，忽略files[0]
      "", // 位置1: 使用files[1]的内容（可能是新文件或storageUrl）
      "https://example.com/another-source.pdf", // 位置2: 从URL抓取，忽略files[2]
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((url) => url.trim())
        .filter((url) => url !== null && url !== undefined) // 保留空字符串，过滤null/undefined
    }
    return value
  })
  originalUrls?: string[]

  @ApiHideProperty()
  @IsOptional()
  files?: any[]
}

export interface IUpdateArchive {
  title?: string
  authors?: string[]
  publisher?: string
  date?: string
  chapter?: string
  tags?: string[]
  remarks?: string
  originalUrls?: string[]
  archiveFilename?: string
  fileType?: string
}
