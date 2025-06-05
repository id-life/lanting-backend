import { PartialType } from "@nestjs/mapped-types"
import { CreateTributeDto } from "./create-tribute.dto"

export class UpdateTributeDto extends PartialType(CreateTributeDto) {}
