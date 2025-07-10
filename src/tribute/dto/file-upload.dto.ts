import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty } from "class-validator"

export class TributeFileUploadDto {
  @ApiProperty({
    description: "归档文件",
    type: "string",
    format: "binary",
  })
  @IsNotEmpty()
  file: Express.Multer.File
}
