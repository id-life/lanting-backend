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
import { ApiBody, ApiConsumes } from "@nestjs/swagger"
import { multerConfig } from "@/config/configuration/multer.config"
import { ArchivesService } from "./archives.service"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { ArchiveFileUploadDto } from "./dto/file-upload.dts"
import { UpdateArchiveDto } from "./dto/update-archive.dto"

@Controller("archives")
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  @Post()
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
  findAll() {
    return this.archivesService.findAll()
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.archivesService.findOne(id)
  }

  @Post(":id")
  @UsePipes(new ValidationPipe({ transform: true }))
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateArchiveDto: UpdateArchiveDto,
  ) {
    return this.archivesService.update(id, updateArchiveDto)
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.archivesService.remove(id)
  }

  @Get("content/:archiveFilename")
  getArchiveContent(@Param("archiveFilename") archiveFilename: string) {
    return this.archivesService.getArchiveContent(archiveFilename)
  }
}
