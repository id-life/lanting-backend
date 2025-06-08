import { Global, Module } from "@nestjs/common"
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
  ],
  exports: [
    PrismaService,
    MetadataExtractorService,
    DateUtilService,
    DeepSeekService,
  ],
})
export class CommonModule {}
