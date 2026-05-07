import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService } from '../llm.service';
import {
  RECO_PROMPT_VERSION,
  RECO_SYSTEM_PROMPT,
  RECO_RESPONSE_SCHEMA,
  RecoClientSnapshot,
  RecoCandidate,
  buildRecoUserMessage,
} from '../prompts/recommendation.prompts';

export interface RecommendInput {
  tenantId: string;
  userId: string;
  storeId?: string;
  clientId: string;
  context?: 'consultation' | 'sale' | 'browsing';
  filters?: {
    category?: 'FRAME' | 'LENS' | 'CONTACT_LENS' | 'ACCESSORY' | 'SOLUTION';
    maxPrice?: number;
    minPrice?: number;
  };
  candidatesLimit?: number;
}

export interface RecommendOutput {
  recommendations: Array<{
    productId: string;
    productName: string;
    price: number;
    rank: number;
    pitch: string;
    reasoning: string;
    confidence: number;
  }>;
  overallAdvice: string;
}

const DEFAULT_CANDIDATE_LIMIT = 20;

/**
 * Recommandation produit hybride :
 *  - Pré-filtrage SQL (compatibilité prescription, stock dispo, filtres user)
 *  - Re-ranking LLM (pertinence, style, upsell)
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async recommendForClient(input: RecommendInput): Promise<RecommendOutput> {
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, tenantId: input.tenantId, deletedAt: null },
      include: {
        prescriptions: { orderBy: { issuedAt: 'desc' }, take: 1 },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          where: { status: { in: ['DELIVERED', 'READY', 'PENDING'] } },
          include: { items: { include: { product: true } } },
        },
      },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const snapshot = this.buildSnapshot(client);
    const candidates = await this.fetchCandidates(input, snapshot);
    if (candidates.length === 0) {
      return { recommendations: [], overallAdvice: 'Aucun produit candidat compatible en stock.' };
    }

    const result = await this.llm.complete({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'reco.products',
      promptVersion: RECO_PROMPT_VERSION,
      model: 'default',
      temperature: 0.2,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'reco', strict: true, schema: RECO_RESPONSE_SCHEMA },
      },
      messages: [
        { role: 'system', content: RECO_SYSTEM_PROMPT },
        { role: 'user', content: buildRecoUserMessage(snapshot, candidates) },
      ],
    });

    if (!result.content) throw new Error('Recommandation vide');
    const parsed = JSON.parse(result.content) as {
      recommendations: { productId: string; rank: number; pitch: string; reasoning: string; confidence: number }[];
      overallAdvice: string;
    };

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const recommendations = parsed.recommendations
      .filter((r) => candidateMap.has(r.productId))
      .map((r) => {
        const c = candidateMap.get(r.productId)!;
        return {
          productId: r.productId,
          productName: c.name,
          price: c.price,
          rank: r.rank,
          pitch: r.pitch,
          reasoning: r.reasoning,
          confidence: r.confidence,
        };
      })
      .sort((a, b) => a.rank - b.rank);

    return { recommendations, overallAdvice: parsed.overallAdvice };
  }

  // ------------- helpers -------------

  private buildSnapshot(client: any): RecoClientSnapshot {
    const lastVisit = client.sales[0]?.createdAt ?? client.lastVisitAt;
    const lastVisitDays = lastVisit
      ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)
      : null;

    const totalSpend = client.sales.reduce(
      (s: number, sale: any) => s + Number(sale.totalTtc ?? 0),
      0,
    );
    const avgBasket = client.sales.length > 0 ? totalSpend / client.sales.length : 0;

    const brandCounter = new Map<string, number>();
    const recentPurchases = client.sales.flatMap((sale: any) =>
      sale.items.map((item: any) => {
        if (item.product?.brand) {
          brandCounter.set(item.product.brand, (brandCounter.get(item.product.brand) ?? 0) + 1);
        }
        return {
          name: item.product?.name ?? item.description,
          category: item.product?.category ?? 'unknown',
          price: Number(item.unitPriceHt) * (1 + Number(item.vatRate ?? 20) / 100),
          daysAgo: Math.floor((Date.now() - new Date(sale.createdAt).getTime()) / 86400000),
        };
      }),
    );
    const observedBrands = [...brandCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([b]) => b);
    const preferredBrands = client.preferredBrands?.length
      ? client.preferredBrands.slice(0, 3)
      : observedBrands;

    const lastRx = client.prescriptions[0];
    const prescription = lastRx
      ? {
          sphereMaxAbs: Math.max(
            Math.abs(Number(lastRx.odSphere ?? 0)),
            Math.abs(Number(lastRx.ogSphere ?? 0)),
          ),
          hasAstigmatism: Boolean(lastRx.odCylinder || lastRx.ogCylinder),
          hasPresbyopia: Boolean(lastRx.odAddition || lastRx.ogAddition),
        }
      : undefined;

    const age = client.birthDate
      ? Math.floor((Date.now() - new Date(client.birthDate).getTime()) / (365.25 * 86400000))
      : null;

    return {
      id: client.id,
      fullName: `${client.firstName} ${client.lastName}`,
      age,
      gender: client.gender,
      lastVisitDays,
      totalSpend,
      avgBasket,
      preferredBrands,
      preferredFrameStyle: client.preferredFrameStyle ?? null,
      preferredFrameColor: client.preferredFrameColor ?? null,
      recentPurchases: recentPurchases.slice(0, 10),
      prescription,
    };
  }

  private async fetchCandidates(
    input: RecommendInput,
    snapshot: RecoClientSnapshot,
  ): Promise<RecoCandidate[]> {
    const limit = input.candidatesLimit ?? DEFAULT_CANDIDATE_LIMIT;
    const where: any = {
      tenantId: input.tenantId,
      isActive: true,
      stockItems: {
        some: {
          quantity: { gt: 0 },
          ...(input.storeId ? { storeId: input.storeId } : {}),
        },
      },
    };
    if (input.filters?.category) where.category = input.filters.category;
    if (input.filters?.minPrice || input.filters?.maxPrice) {
      where.sellPriceTtc = {
        ...(input.filters.minPrice ? { gte: input.filters.minPrice } : {}),
        ...(input.filters.maxPrice ? { lte: input.filters.maxPrice } : {}),
      };
    }
    // Pour fortes corrections, exiger un indice de verre élevé OU rester sur les montures
    if (snapshot.prescription && snapshot.prescription.sphereMaxAbs > 4) {
      where.OR = [
        { lensIndex: { gte: 1.6 } },
        { category: { not: 'LENS' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      take: limit,
      orderBy: [{ sellPriceTtc: 'desc' as const }],
      include: {
        stockItems: {
          where: input.storeId ? { storeId: input.storeId } : {},
          select: { quantity: true },
        },
      },
    });

    return products.map((p) => {
      const sellTtc = Number(p.sellPriceTtc);
      const costHt = Number(p.costPriceHt ?? 0);
      const sellHt = sellTtc / (1 + Number(p.vatRate) / 100);
      const margin = sellHt > 0 && costHt > 0 ? Math.round(((sellHt - costHt) / sellHt) * 100) : 0;
      const attrs: Record<string, any> = {
        ...((p.metadata as any) ?? {}),
        material: p.frameMaterial,
        color: p.frameColor,
        shape: p.frameShape,
        size: p.frameSize,
        lensIndex: p.lensIndex ? Number(p.lensIndex) : null,
        lensTreatment: p.lensTreatment,
        subcategory: p.subcategory,
      };
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: sellTtc,
        margin,
        attributes: attrs,
        stock: p.stockItems.reduce((s, si) => s + si.quantity, 0),
      };
    });
  }
}
