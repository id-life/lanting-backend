import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import * as R from "ramda"
import { ConfigService } from "@/config/config.service"

@Injectable()
export class AwsService {
  private readonly logger: Logger = new Logger(AwsService.name)

  private bucketName: string
  private client: S3Client

  constructor(private configService: ConfigService) {
    if (!this.configService.awsS3AccessKey) {
      throw new BadRequestException("AWS S3 Access Key is not configured")
    }
    if (!this.configService.awsS3SecretKey) {
      throw new BadRequestException("AWS S3 Secret Key is not configured")
    }
    if (!this.configService.awsS3Bucket) {
      throw new BadRequestException("AWS S3 Bucket is not configured")
    }

    this.bucketName = this.configService.awsS3Bucket
    this.client = new S3Client({
      region: "ap-southeast-1",
      credentials: {
        accessKeyId: this.configService.awsS3AccessKey,
        secretAccessKey: this.configService.awsS3SecretKey,
      },
    })
  }

  /**
   * 计算文件 Hash, 防止重名文件
   *
   * @param buffer
   * @private
   */
  private computeFileHash(buffer: Buffer) {
    const hash = createHash("md5")
    hash.update(buffer)
    return hash.digest("hex")
  }

  /**
   * 监测上传文件是否存在
   *
   * @param {string} bucketName
   * @param {string} filePath
   * @private
   */
  private async checkFileExistsInS3(bucketName: string, filePath: string) {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: filePath })
    try {
      const { $metadata } = await this.client.send(command)
      return $metadata.httpStatusCode === 200
    } catch (error) {
      if (error.Code === "NoSuchKey") return false
      throw new BadRequestException(error)
    }
  }

  /**
   * 上传文件
   *
   * @param dir -- 文件目录
   * @param filename -- 文件名
   * @param dataBuffer -- 数据源
   */
  async uploadPublicFile(dir: string, filename: string, dataBuffer: Buffer) {
    const fileExtension = R.last(R.split(".", filename))
    const hash = this.computeFileHash(dataBuffer)
    const filePath = `${dir}/${hash}.${fileExtension}`
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
      Body: dataBuffer,
    })

    try {
      // 监测当前文件是否存在, 存在则返回已存在的 md5 路径
      const isExist = await this.checkFileExistsInS3(this.bucketName, filePath)
      if (isExist) return filePath
      // 当前文件不存在, 上传文件, 返回 md5 路径
      const { $metadata } = await this.client.send(command)
      if ($metadata.httpStatusCode === 200) return filePath
      return Promise.reject(new Error("upload failed"))
    } catch (error) {
      this.logger.error(`${error.message}, dir: ${dir}, filename: ${filename}`)
      throw new BadRequestException(error)
    }
  }

  /**
   * 根据路径获取文件内容
   *
   * @param filePath -- 文件路径
   * @returns 文件内容（Buffer）
   */
  async getFileContent(filePath: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      })

      const response = await this.client.send(command)

      // 将流转换为Buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks)
    } catch (error) {
      this.logger.error(
        `getFileContent error-filePath-${filePath} error-${error.message}`,
      )
      throw new BadRequestException(["FileNotFound"])
    }
  }
}
