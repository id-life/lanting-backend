import { ApiProperty } from "@nestjs/swagger"
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator"

export class SearchKeywordDto {
  @ApiProperty({
    description: "搜索关键词",
    example: "JavaScript",
  })
  @IsString()
  @IsNotEmpty()
  keyword: string
}

export class SearchKeywordQueryDto {
  @ApiProperty({
    description: "页码",
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @ApiProperty({
    description: "每页数量",
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10

  @ApiProperty({
    description: "排序方式",
    example: "count",
    enum: ["count", "keyword", "createdAt"],
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: "count" | "keyword" | "createdAt" = "count"

  @ApiProperty({
    description: "排序顺序",
    example: "desc",
    enum: ["asc", "desc"],
    required: false,
  })
  @IsOptional()
  @IsString()
  order?: "asc" | "desc" = "desc"
}
