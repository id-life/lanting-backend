import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"
import { multerConfig } from "@/config/configuration/multer.config"
import { ArchivesService } from "./archives.service"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { ArchiveFileUploadDto } from "./dto/file-upload.dts"
import { UpdateArchiveDto } from "./dto/update-archive.dto"
import { Archive } from "./entities/archive.entity"

@ApiTags("archives")
@Controller("archives")
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  @Post()
  @ApiOperation({ summary: "创建新归档" })
  @ApiResponse({ status: 201, description: "归档创建成功", type: Archive })
  @ApiBody({ type: ArchiveFileUploadDto })
  @ApiConsumes("multipart/form-data")
  @UsePipes(new ValidationPipe({ transform: true }))
  @UseInterceptors(FileInterceptor("file", multerConfig))
  create(
    @Body() createArchiveDto: CreateArchiveDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.archivesService.create(createArchiveDto, file)
  }

  @Get()
  @ApiOperation({ summary: "获取所有归档" })
  @ApiResponse({ status: 200, description: "返回所有归档", type: [Archive] })
  findAll() {
    return this.archivesService.findAll()
  }

  @Get(":id")
  @ApiOperation({ summary: "根据ID获取归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiResponse({ status: 200, description: "返回指定ID的归档", type: Archive })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.archivesService.findOne(id)
  }

  @Post(":id")
  @ApiOperation({ summary: "更新归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiResponse({ status: 200, description: "归档更新成功", type: Archive })
  @UsePipes(new ValidationPipe({ transform: true }))
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateArchiveDto: UpdateArchiveDto,
  ) {
    return this.archivesService.update(id, updateArchiveDto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "删除归档" })
  @ApiParam({ name: "id", description: "归档ID" })
  @ApiResponse({ status: 200, description: "归档删除成功" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.archivesService.remove(id)
  }

  @Get("content/:archiveFilename")
  @ApiOperation({ summary: "获取归档内容" })
  @ApiParam({ name: "archiveFilename", description: "归档文件名" })
  @ApiResponse({ status: 200, description: "返回归档内容" })
  getArchiveContent(@Param("archiveFilename") archiveFilename: string) {
    return this.archivesService.getArchiveContent(archiveFilename)
  }
}
