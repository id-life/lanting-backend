import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty } from "class-validator"

export class AddEmailDto {
  @ApiProperty({
    description: "Email address to add to whitelist",
    example: "user@example.com",
  })
  @IsNotEmpty()
  @IsEmail()
  email: string
}
