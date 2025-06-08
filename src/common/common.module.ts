import { Global, Module } from "@nestjs/common"
import { AwsService } from "./aws/aws.service"
import { DateUtilService } from "./date-util/date-util.service"
import { DeepSeekService } from "./deepseek/deepseek.service"
import { MetadataExtractorService } from "./metadata-extractor/metadata-extractor.service"
import { PrismaService } from "./prisma/prisma.service"
import { RedisModule } from "./redis/redis.module"

@Global()
@Module({
  imports: [RedisModule],
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
    RedisModule,
  ],
})
export class CommonModule {}
