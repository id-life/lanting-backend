import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsNumberString, IsOptional } from "class-validator"

export class TributeFileUploadDto {
  @ApiPropertyOptional({
    description: "待分析的 HTML 文件",
    type: "string",
    format: "binary",
  })
  @IsOptional()
  file?: Express.Multer.File

  @ApiPropertyOptional({
    description: "待处理文件的 ID，需与用户白名单邮箱匹配",
  })
  @IsOptional()
  @IsNumberString()
  pendingOrigId?: string
}
