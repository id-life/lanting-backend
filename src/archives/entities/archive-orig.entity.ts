import { ApiProperty } from "@nestjs/swagger"

export class ArchiveOrig {
  @ApiProperty({
    description: "唯一ID",
    example: 1,
  })
  id: number

  @ApiProperty({
    description: "归档ID",
    example: 1,
  })
  archiveId: number

  @ApiProperty({
    description: "原始URL",
    nullable: true,
    example: "https://example.com/original",
  })
  originalUrl: string | null

  @ApiProperty({
    description: "存储URL",
    example: "https://example.com/storage/file.html",
  })
  storageUrl: string

  @ApiProperty({
    description: "文件类型",
    nullable: true,
    example: "html",
  })
  fileType: string | null

  @ApiProperty({
    description: "存储类型",
    example: "s3",
    enum: ["s3", "oss"],
  })
  storageType: string

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
