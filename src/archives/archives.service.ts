import { Buffer } from "node:buffer"
import { extname } from "node:path"
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { execa } from "execa"
import { AwsService } from "@/common/aws/aws.service"
import { ConfigService } from "@/config/config.service"
import { PrismaService } from "../common/prisma/prisma.service"
import { CreateArchiveDto, ICreateArchive } from "./dto/create-archive.dto"
import { UpdateArchiveDto } from "./dto/update-archive.dto"

@Injectable()
export class ArchivesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService,
  ) {}

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

  async create(createArchiveDto: CreateArchiveDto, file?: Express.Multer.File) {
    // try {
    //   const archive = await this.prismaService.archive.create({
    //     data: createArchiveDto,
    //   })

    //   return {
    //     success: true,
    //     data: archive,
    //   }
    // } catch (error) {
    //   this.handleError(error, "create")
    // }

    const archive: ICreateArchive = {
      ...createArchiveDto,
    }

    try {
      let fileContent: Buffer
      if (!file && !archive.originalUrl) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: "Either a file or an original URL must be provided",
        })
      } else if (file) {
        // upload
        const fileExt = extname(file.originalname).toLowerCase()
        archive.fileType = fileExt.substring(1)
        fileContent = file.buffer
      } else if (archive.originalUrl) {
        // use single-file-cli
        try {
          const { stdout, stderr } = await execa("single-file", [
            archive.originalUrl,
            "--dump-content",
          ])

          if (stderr) {
            throw new BadRequestException({
              success: false,
              data: null,
              message: `Failed to fetch content from original URL: ${stderr}`,
            })
          }

          archive.fileType = "html"
          fileContent = Buffer.from(stdout, "utf-8")
        } catch {
          const simpleHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${archive.title}</title>
            <meta name="author" content="${archive.author}">
            <meta name="date" content="${archive.date}">
          </head>
          <body>
            <h1>${archive.title}</h1>
            <p>原始链接: <a href="${archive.originalUrl}">${archive.originalUrl}</a></p>
            <p>作者: ${archive.author}</p>
            <p>出版方: ${archive.publisher}</p>
            <p>日期: ${archive.date}</p>
            <p>备注: ${archive.remarks || ""}</p>
            <p>抓取失败，请访问原始链接查看内容。</p>
          </body>
          </html>
        `
          archive.fileType = "html"
          fileContent = Buffer.from(simpleHtml, "utf-8")
        }
      }

      // relative path, use this.awsService.getFileContent to get the file content
      const archivePath = await this.awsService.uploadPublicFile(
        this.configService.awsS3Directory,
        `${createArchiveDto.title}${Date.now()}${archive.fileType ? `.${archive.fileType}` : ""}`,
        fileContent!,
      )
      archive.archiveFilename = archivePath.replace(
        `${this.configService.awsS3Directory}/`,
        "",
      )

      const archiveRes = await this.prismaService.archive.create({
        data: archive,
      })

      return {
        success: true,
        data: archiveRes,
      }
    } catch (error) {
      this.handleError(error, "create")
    }
  }

  async findAll() {
    try {
      const archives = await this.prismaService.archive.findMany({
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
      const archive = await this.prismaService.archive.findUnique({
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

      const archive = await this.prismaService.archive.update({
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

      await this.prismaService.archive.delete({
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

  async getArchiveContent(archiveFilename: string) {
    try {
      const content = await this.awsService.getFileContent(
        `${this.configService.awsS3Directory}/${archiveFilename}`,
      )

      return content.toString("utf-8")
    } catch (error) {
      this.handleError(error, "fetch")
    }
  }
}
