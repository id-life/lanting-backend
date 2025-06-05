import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../common/prisma/prisma.service"
import { CreateArchiveDto } from "./dto/create-archive.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"

@Injectable()
export class ArchivesService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new Error(`Failed to create archive: ${error.message}`)
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
      throw new Error(`Failed to fetch archives: ${error.message}`)
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
          message: `Archive with ID ${id} not found`,
        })
      }

      return {
        success: true,
        data: archive,
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error
      }
      throw new Error(`Failed to fetch archive: ${error.message}`)
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
      if (error instanceof NotFoundException) {
        throw error
      }
      throw new Error(`Failed to update archive: ${error.message}`)
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
      if (error instanceof NotFoundException) {
        throw error
      }
      throw new Error(`Failed to delete archive: ${error.message}`)
    }
  }
}
