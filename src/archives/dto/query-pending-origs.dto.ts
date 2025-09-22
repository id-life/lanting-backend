import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsIn, IsOptional } from "class-validator"

export class QueryPendingOrigsDto {
  @ApiPropertyOptional({
    description: "状态筛选",
    enum: ["pending", "archived"],
    default: "pending",
  })
  @IsOptional()
  @IsIn(["pending", "archived"])
  status?: "pending" | "archived" = "pending"
}
