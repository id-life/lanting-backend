import { IsNotEmpty } from "class-validator"

export class TributeFileUploadDto {
  @IsNotEmpty()
  file: Express.Multer.File
}
