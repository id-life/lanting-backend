import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsArray, IsEnum, IsOptional, IsString } from "class-validator"
import { ArchiveChapter } from "~/generated/prisma"

export class CreateArchiveDto {
  @ApiProperty({
    description: "文档标题",
    example: "文档标题",
  })
  @IsString()
  title: string

  @ApiProperty({
    description: "作者",
    required: false,
    example: "张三",
  })
  @IsOptional()
  @IsString()
  author?: string

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
    enum: ArchiveChapter,
    required: false,
    example: "本纪",
  })
  @IsOptional()
  @IsEnum(ArchiveChapter)
  chapter?: ArchiveChapter

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
  tag?: string[]

  @ApiProperty({
    description: "备注",
    required: false,
    example: "这是一条备注信息",
  })
  @IsOptional()
  @IsString()
  remarks?: string

  @ApiProperty({
    description: "原始URL",
    required: false,
    example: "https://example.com/original",
  })
  @IsOptional()
  @IsString()
  originalUrl?: string

  // @IsOptional()
  // @IsString()
  // archiveFilename?: string

  // @IsOptional()
  // @IsString()
  // fileType?: string
}

export interface ICreateArchive {
  title: string
  author?: string
  publisher?: string
  date?: string
  chapter?: ArchiveChapter
  tag?: string[]
  remarks?: string
  originalUrl?: string
  archiveFilename?: string
  fileType?: string
}
