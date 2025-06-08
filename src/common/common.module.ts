import { Global, Module } from "@nestjs/common"
import { AwsService } from "./aws/aws.service"
import { DateUtilService } from "./date-util/date-util.service"
import { DeepSeekService } from "./deepseek/deepseek.service"
import { MetadataExtractorService } from "./metadata-extractor/metadata-extractor.service"
import { PrismaService } from "./prisma/prisma.service"

@Global()
@Module({
  providers: [
    PrismaService,
    MetadataExtractorService,
    DateUtilService,
    DeepSeekService,
    AwsService,
  ],
  exports: [
    PrismaService,
    MetadataExtractorService,
    DateUtilService,
    DeepSeekService,
    AwsService,
  ],
})
export class CommonModule {}
