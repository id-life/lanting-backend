import { ApiProperty } from "@nestjs/swagger"
import { IsArray, IsEmail, IsNotEmpty } from "class-validator"

export class UpdateWhitelistDto {
  @ApiProperty({
    description: "List of email addresses for the whitelist",
    example: ["user@gmail.com", "user@company.com"],
    type: [String],
  })
  @IsArray()
  @IsNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[]
}
