import { ApiProperty } from "@nestjs/swagger"

export class ArchiveAuthor {
  @ApiProperty({
    description: "档案ID",
    example: 1,
  })
  archiveId: number

  @ApiProperty({
    description: "作者ID",
    example: 1,
  })
  authorId: number

  @ApiProperty({
    description: "作者在该档案中的排序",
    example: 1,
  })
  order: number

  @ApiProperty({
    description: "档案信息",
    required: false,
  })
  archive?: any

  @ApiProperty({
    description: "作者信息",
    required: false,
  })
  author?: any
}
