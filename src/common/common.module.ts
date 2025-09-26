import { HttpModule } from "@nestjs/axios"
import { Global, Module } from "@nestjs/common"
import { AwsService } from "./aws/aws.service"
import { DateUtilService } from "./date-util/date-util.service"
import { DeepSeekService } from "./deepseek/deepseek.service"
import { ImapflowService } from "./imapflow/imapflow.service"
import { MetadataExtractorService } from "./metadata-extractor/metadata-extractor.service"
import { PrismaService } from "./prisma/prisma.service"
import { RedisModule } from "./redis/redis.module"

@Global()
@Module({
  imports: [
    RedisModule,
    HttpModule.registerAsync({
      useFactory: async () => {
        return {
          timeout: 120_000,
          maxRedirects: 3,
        }
      },
    }),
  ],
  providers: [
    PrismaService,
    MetadataExtractorService,
    DateUtilService,
    DeepSeekService,
    AwsService,
    ImapflowService,
  ],
  exports: [
    PrismaService,
    MetadataExtractorService,
    DateUtilService,
    DeepSeekService,
    AwsService,
    ImapflowService,
    RedisModule,
  ],
})
export class CommonModule {}
