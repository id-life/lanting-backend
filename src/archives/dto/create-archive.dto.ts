import { ApiHideProperty, ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateArchiveDto {
  @ApiProperty({
    description: "文档标题",
    example: "文档标题",
  })
  @IsString()
  title: string

  @ApiProperty({
    description: "作者列表",
    required: false,
    type: "array",
    items: {
      type: "string",
    },
    example: ["张三", "李四"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((author) => author.trim())
        .filter((author) => author)
    }
    return value
  })
  authors?: string[]

  @ApiProperty({
    description: "出版方",
    required: false,
    example: "某某出版社",
  })
  @IsOptional()
  @IsString()
  publisher?: string

  @ApiProperty({
    description: "日期",
    required: false,
    example: "2025-06-08",
  })
  @IsOptional()
  @IsString()
  date?: string

  @ApiProperty({
    description: "章节类别",
    required: true,
    example: "本纪",
    enum: ["本纪", "世家", "搜神", "列传", "游侠", "群像", "随园食单"],
  })
  @IsNotEmpty()
  @IsString()
  chapter: string

  @ApiProperty({
    description: "标签列表",
    type: [String],
    required: false,
    example: ["标签1", "标签2"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag)
    }
    return value
  })
  tags?: string[]

  @ApiProperty({
    description: "备注",
    required: false,
    example: "这是一条备注信息",
  })
  @IsOptional()
  @IsString()
  remarks?: string

  @ApiProperty({
    description:
      "文件原始URL列表（可选）。支持灵活的混合模式：按索引位置与files数组对应，每个位置可以是：1) 仅URL（系统抓取） 2) 仅文件上传 3) 文件+URL（备份模式）。空字符串表示该位置无URL。",
    required: false,
    type: "array",
    items: {
      type: "string",
    },
    example: [
      "https://example.com/online-only", // 位置0: 仅URL抓取
      "https://example.com/with-backup", // 位置1: 文件+URL备份
      "", // 位置2: 仅文件上传
      "https://example.com/another-url", // 位置3: 仅URL抓取
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",").map((url) => url.trim())
    }
    return value
  })
  originalUrls?: string[]

  @ApiProperty({
    description:
      "待处理文件ID列表（可选）。按索引位置与files和originalUrls数组对应，每个位置可以是文件ID或null。用于选择已上传到AWS的待处理文件。",
    required: false,
    type: "array",
    items: {
      type: "number",
      nullable: true,
    },
    example: [123, null, 456, null], // 位置0和2使用待处理文件，位置1和3为其他方式
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",").map((id) => {
        const trimmed = id.trim()
        return trimmed === "" || trimmed === "null"
          ? null
          : Number.parseInt(trimmed, 10)
      })
    }
    return value
  })
  pendingOrigIds?: (number | null)[]

  @ApiHideProperty()
  @IsOptional()
  files?: any[]
}

export interface ICreateArchive {
  title: string
  authors?: string[]
  publisher?: string
  date?: string
  chapter: string
  tags?: string[]
  remarks?: string
  originalUrls?: string[]
  pendingOrigIds?: (number | null)[]
  archiveFilename?: string
  fileType?: string
}

export interface FileProcessingItem {
  file?: Express.Multer.File
  originalUrl?: string
  pendingOrigId?: number | null
  fileIndex: number
}
