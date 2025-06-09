import { ApiProperty } from "@nestjs/swagger"
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
  chapter: string
  tag?: string[]
  remarks?: string
  originalUrl?: string
  archiveFilename?: string
  fileType?: string
}
