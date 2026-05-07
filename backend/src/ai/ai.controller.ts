import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsArray,
  IsBoolean,
  IsNumber,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

import { ChatService } from './services/chat.service';
import { RecommendationService } from './services/recommendation.service';
import { SalesAnalysisService } from './services/sales-analysis.service';
import { StockPredictionService } from './services/stock-prediction.service';
import { MarketingService } from './services/marketing.service';
import { ClientSummaryService } from './services/client-summary.service';
import { QuotaService } from './quota.service';

// ----- DTOs -----

class ChatMessageDto {
 @IsOptional() @IsString() conversationId?: string;
  @IsString() @MinLength(1) @MaxLength(4000) message!: string;
  @IsOptional() @IsString() storeId?: string;
}

class RecommendDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsIn(['consultation', 'sale', 'browsing']) context?: 'consultation' | 'sale' | 'browsing';
  @IsOptional() filters?: { category?: string; minPrice?: number; maxPrice?: number };
}

class AnalyzeSalesDto {
  @IsIn(['week', 'month', 'quarter']) period!: 'week' | 'month' | 'quarter';
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() date?: string; // ISO
}

class PredictStockDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsArray() productIds?: string[];
}

class GenerateMessageDto {
  @IsString() clientId!: string;
  @IsIn(['email', 'sms']) channel!: 'email' | 'sms';
  @IsString() scenario!: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() @MaxLength(500) customNote?: string;
}

class IdentifyTargetsDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() scenarioFilter?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

class ClientSummaryDto {
  @IsString() clientId!: string;
  @IsOptional() @IsBoolean() forceRefresh?: boolean;
}

// ----- Controller -----

@Controller({ path: 'ai', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private readonly chat: ChatService,
    private readonly reco: RecommendationService,
    private readonly sales: SalesAnalysisService,
    private readonly stock: StockPredictionService,
    private readonly marketing: MarketingService,
    private readonly clientSummary: ClientSummaryService,
    private readonly quota: QuotaService,
  ) {}

  // ------------- CHAT (SSE) -------------

  /**
   * Stream SSE pour le chat IA.
   * Le client doit ouvrir une EventSource POST avec les en-têtes adéquats côté front,
   * ou utiliser fetch + ReadableStream. Format : `data: {json}\n\n`.
   */
  @Post('chat/stream')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  @Throttle({ ai: { limit: 30, ttl: 60_000 } })
  async chatStream(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // pour nginx
    res.flushHeaders?.();

    const send = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const generator = this.chat.streamMessage({
        tenantId: user.tenantId,
        userId: user.userId,
        storeId: dto.storeId,
        conversationId: dto.conversationId,
        userMessage: dto.message,
      });
      for await (const ev of generator) {
        send(ev);
      }
    } catch (err: any) {
      send({ type: 'error', message: err.message ?? 'Erreur serveur' });
    } finally {
      res.end();
    }
  }

  @Get('chat/conversations')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user.tenantId, user.userId);
  }

  @Get('chat/conversations/:id')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  getConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.getConversation(user.tenantId, user.userId, id);
  }

  @Delete('chat/conversations/:id')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.deleteConversation(user.tenantId, user.userId, id);
  }

  // ------------- RECOMMANDATIONS -------------

  @Post('recommendations')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  @Throttle({ ai: { limit: 60, ttl: 60_000 } })
  recommend(@CurrentUser() user: AuthUser, @Body() dto: RecommendDto) {
    return this.reco.recommendForClient({
      tenantId: user.tenantId,
      userId: user.userId,
      storeId: dto.storeId,
      clientId: dto.clientId,
      context: dto.context,
      filters: dto.filters as any,
    });
  }

  // ------------- ANALYSE VENTES -------------

  @Post('sales/analyze')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN')
  @Throttle({ ai: { limit: 20, ttl: 60_000 } })
  analyzeSales(@CurrentUser() user: AuthUser, @Body() dto: AnalyzeSalesDto) {
    return this.sales.analyze({
      tenantId: user.tenantId,
      userId: user.userId,
      storeId: dto.storeId,
      period: dto.period,
      date: dto.date ? new Date(dto.date) : undefined,
    });
  }

  // ------------- PRÉDICTION STOCK -------------

  @Post('stock/predict')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN')
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  predictStock(@CurrentUser() user: AuthUser, @Body() dto: PredictStockDto) {
    return this.stock.predict({
      tenantId: user.tenantId,
      userId: user.userId,
      storeId: dto.storeId,
      productIds: dto.productIds,
    });
  }

  @Post('stock/purchase-order/draft')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN')
  generatePoDraft(@CurrentUser() user: AuthUser, @Body() dto: PredictStockDto) {
    return this.stock.generatePurchaseOrderDraft({
      tenantId: user.tenantId,
      userId: user.userId,
      storeId: dto.storeId,
      productIds: dto.productIds,
    });
  }

  // ------------- MARKETING -------------

  @Post('marketing/message')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN')
  @Throttle({ ai: { limit: 30, ttl: 60_000 } })
  generateMessage(@CurrentUser() user: AuthUser, @Body() dto: GenerateMessageDto) {
    return this.marketing.generateMessage({
      tenantId: user.tenantId,
      userId: user.userId,
      storeId: dto.storeId,
      clientId: dto.clientId,
      channel: dto.channel,
      scenario: dto.scenario as any,
      customNote: dto.customNote,
    });
  }

  @Post('marketing/identify-targets')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN')
  @Throttle({ ai: { limit: 5, ttl: 60_000 } })
  identifyTargets(@CurrentUser() user: AuthUser, @Body() dto: IdentifyTargetsDto) {
    return this.marketing.identifyTargets({
      tenantId: user.tenantId,
      userId: user.userId,
      storeId: dto.storeId,
      scenarioFilter: dto.scenarioFilter as any,
      limit: dto.limit,
    });
  }

  // ------------- RÉSUMÉ CLIENT -------------

  @Post('clients/summary')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  @Throttle({ ai: { limit: 60, ttl: 60_000 } })
  clientSummaryEndpoint(@CurrentUser() user: AuthUser, @Body() dto: ClientSummaryDto) {
    return this.clientSummary.summarize({
      tenantId: user.tenantId,
      userId: user.userId,
      clientId: dto.clientId,
      forceRefresh: dto.forceRefresh,
    });
  }

  // ------------- QUOTA -------------

  @Get('quota')
  @Roles('OWNER', 'ADMIN', 'OPTICIAN', 'EMPLOYEE')
  getQuota(@CurrentUser() user: AuthUser) {
    return this.quota.getStatus(user.tenantId);
  }
}
