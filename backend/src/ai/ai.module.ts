import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AiController } from './ai.controller';
import { LlmService } from './llm.service';
import { QuotaService } from './quota.service';
import { ContextBuilderService } from './context-builder.service';
import { ChatService } from './services/chat.service';
import { RecommendationService } from './services/recommendation.service';
import { SalesAnalysisService } from './services/sales-analysis.service';
import { StockPredictionService } from './services/stock-prediction.service';
import { OcrService } from './services/ocr.service';
import { MarketingService } from './services/marketing.service';
import { ClientSummaryService } from './services/client-summary.service';
import { ToolRegistry } from './tools/tool-registry';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: 'ai-ocr' },
      { name: 'ai-stock-prediction' },
      { name: 'ai-marketing' },
    ),
  ],
  controllers: [AiController],
  providers: [
    LlmService,
    QuotaService,
    ContextBuilderService,
    ToolRegistry,
    ChatService,
    RecommendationService,
    SalesAnalysisService,
    StockPredictionService,
    OcrService,
    MarketingService,
    ClientSummaryService,
  ],
  exports: [
    LlmService,
    OcrService,
    RecommendationService,
    ClientSummaryService,
    SalesAnalysisService,
    StockPredictionService,
    MarketingService,
  ],
})
export class AiModule {}
