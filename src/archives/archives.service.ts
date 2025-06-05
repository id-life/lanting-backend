import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../common/prisma/prisma.service"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"

@Injectable()
export class ArchivesService {
  constructor(private readonly prisma: PrismaService) {}

  private handleError(error: any, operation: string) {
    const errorResponse = {
      success: false,
      data: null,
      message: error.message || `Failed to ${operation} archive`,
    }

    if (error instanceof NotFoundException) {
      throw new NotFoundException(errorResponse)
    }

    if (error instanceof BadRequestException) {
      throw new BadRequestException(errorResponse)
    }

    const ErrorClass =
      operation === "fetch" ? InternalServerErrorException : BadRequestException

    throw new ErrorClass({
      ...errorResponse,
      message: `Failed to ${operation} archive: ${error.message}`,
    })
  }

  async create(createArchiveDto: CreateArchiveDto) {
    try {
      const archive = await this.prisma.archive.create({
        data: createArchiveDto,
      })

      return {
        success: true,
        data: archive,
      }
    } catch (error) {
      this.handleError(error, "create")
    }
  }

  async findAll() {
    try {
      const archives = await this.prisma.archive.findMany({
        orderBy: { createdAt: "desc" },
      })

      return {
        success: true,
        count: archives.length,
        data: archives,
      }
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  async findOne(id: number) {
    try {
      const archive = await this.prisma.archive.findUnique({
        where: { id },
      })

      if (!archive) {
        throw new NotFoundException({
          success: false,
          data: null,
          message: `Archive with ID ${id} not found`,
        })
      }

      return {
        success: true,
        data: archive,
      }
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }

  async update(id: number, updateArchiveDto: UpdateArchiveDto) {
    try {
      await this.findOne(id)

      const archive = await this.prisma.archive.update({
        where: { id },
        data: updateArchiveDto,
      })

      return {
        success: true,
        data: archive,
      }
    } catch (error) {
      this.handleError(error, "update")
    }
  }

  async remove(id: number) {
    try {
      await this.findOne(id)

      await this.prisma.archive.delete({
        where: { id },
      })

      return {
        success: true,
        message: `Archive with ID ${id} deleted successfully`,
      }
    } catch (error) {
      this.handleError(error, "delete")
    }
  }
}
