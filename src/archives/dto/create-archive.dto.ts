import { Transform } from "class-transformer"
import { IsArray, IsEnum, IsOptional, IsString } from "class-validator"
import { ArchiveChapter } from "~/generated/prisma"

export class CreateArchiveDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  author?: string

  @IsOptional()
  @IsString()
  publisher?: string

  @IsOptional()
  @IsString()
  date?: string

  @IsOptional()
  @IsEnum(ArchiveChapter)
  chapter?: ArchiveChapter

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

  @IsOptional()
  @IsString()
  remarks?: string

  @IsOptional()
  @IsString()
  originalUrl?: string

  @IsOptional()
  @IsString()
  archiveUrl?: string
}
