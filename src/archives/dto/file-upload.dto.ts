import { ApiProperty } from "@nestjs/swagger"

export class ArchiveFileUploadDto {
  @ApiProperty({
    description: "归档文件",
    type: "string",
    format: "binary",
    required: false,
  })
  file?: Express.Multer.File
}
