import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService } from '../llm.service';
import {
  STOCK_PROMPT_VERSION,
  STOCK_SYSTEM_PROMPT,
  STOCK_RESPONSE_SCHEMA,
  StockItemHistory,
  buildStockUserMessage,
} from '../prompts/stock.prompts';

const HISTORY_WEEKS = 12;
const BATCH_SIZE = 50; // produits par appel LLM

export interface PredictStockInput {
  tenantId: string;
  userId: string;
  storeId?: string;
  productIds?: string[]; // optionnel : sous-ensemble explicite
}

export interface StockPrediction {
  productId: string;
  productName: string;
  predictedUnits4Weeks: number;
  predictedUnits12Weeks: number;
  trend: 'rising' | 'stable' | 'declining';
  confidence: number;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  currentStock: number;
  urgency: 'immediate' | 'within_7d' | 'within_30d';
  suggestedQuantity: number;
  reasoning: string;
  supplierName: string | null;
  supplierId: string | null;
  estimatedCost: number;
}

export interface DeadStockAlert {
  productId: string;
  productName: string;
  weeksWithoutSale: number;
  currentStock: number;
  recommendedAction: string;
}

export interface PredictStockResult {
  generatedAt: string;
  storeId: string | null;
  productCount: number;
  predictions: StockPrediction[];
  reorderSuggestions: ReorderSuggestion[];
  deadStockAlerts: DeadStockAlert[];
  costUsd: number;
}

interface PurchaseOrderDraft {
  supplierId: string;
  supplierName: string;
  estimatedCost: number;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCostHt: number;
    lineTotalHt: number;
    urgency: 'immediate' | 'within_7d' | 'within_30d';
    reasoning: string;
  }>;
}

export interface PurchaseOrderDraftResult {
  generatedAt: string;
  drafts: PurchaseOrderDraft[];
  totalEstimatedCost: number;
  warnings: string[];
}

@Injectable()
export class StockPredictionService {
  private readonly logger = new Logger(StockPredictionService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  /**
   * Prédit la demande et propose des réapprovisionnements pour un store (ou tous).
   */
  async predict(input: PredictStockInput): Promise<PredictStockResult> {
    // 1. Charger les produits actifs concernés (hors LENS — produits sur commande)
    const products = await this.prisma.product.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        category: { not: 'LENS' as any },
        ...(input.productIds && input.productIds.length > 0
          ? { id: { in: input.productIds } }
          : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, leadTimeDays: true } },
        stockItems: input.storeId
          ? { where: { storeId: input.storeId }, select: { quantity: true, reorderPoint: true } }
          : { select: { quantity: true, reorderPoint: true, storeId: true } },
      },
      take: 500,
    });

    if (products.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        storeId: input.storeId ?? null,
        productCount: 0,
        predictions: [],
        reorderSuggestions: [],
        deadStockAlerts: [],
        costUsd: 0,
      };
    }

    // 2. Charger l'historique de ventes (12 dernières semaines)
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_WEEKS * 7);

    const productIds = products.map((p) => p.id);

    const salesHistory = await this.prisma.$queryRawUnsafe<
      Array<{ product_id: string; week_start: Date; units: bigint }>
    >(
      `
      SELECT 
        si.product_id,
        date_trunc('week', s.created_at)::timestamp AS week_start,
        SUM(si.quantity)::bigint AS units
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id = $1
        AND s.status = 'DELIVERED'
        AND s.created_at >= $2
        AND si.product_id = ANY($3)
        ${input.storeId ? 'AND s.store_id = $4' : ''}
      GROUP BY si.product_id, week_start
      ORDER BY si.product_id, week_start;
      `,
      input.tenantId,
      since,
      productIds,
      ...(input.storeId ? [input.storeId] : []),
    );

    // Indexer l'historique
    const historyByProduct = new Map<string, { weekStart: string; units: number }[]>();
    for (const row of salesHistory) {
      const arr = historyByProduct.get(row.product_id) ?? [];
      arr.push({
        weekStart: row.week_start.toISOString().slice(0, 10),
        units: Number(row.units),
      });
      historyByProduct.set(row.product_id, arr);
    }

    // 3. Bâtir les StockItemHistory
    const items: StockItemHistory[] = products.map((p) => {
      const currentStock = (p.stockItems as Array<{ quantity: number }>).reduce(
        (sum, si) => sum + si.quantity,
        0,
      );
      return {
        productId: p.id,
        productName: `${p.brand ?? ''} ${p.name}`.trim(),
        category: p.category,
        supplier: p.supplier?.name ?? null,
        currentStock,
        reorderPoint: p.reorderPoint,
        leadTimeDays: p.supplier?.leadTimeDays ?? 14,
        unitCost: Number(p.costPriceHt ?? 0),
        weeklySales: historyByProduct.get(p.id) ?? [],
      };
    });

    // 4. Appel LLM par batch
    const allPredictions: StockPrediction[] = [];
    const allReorder: ReorderSuggestion[] = [];
    const allDeadStock: DeadStockAlert[] = [];
    let totalCost = 0;

    const productById = new Map(products.map((p) => [p.id, p]));
    const asOf = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const result = await this.llm.complete({
        tenantId: input.tenantId,
        userId: input.userId,
        feature: 'stock-prediction',
        promptVersion: STOCK_PROMPT_VERSION,
        messages: [
          { role: 'system', content: STOCK_SYSTEM_PROMPT },
          { role: 'user', content: buildStockUserMessage(batch, asOf) },
        ],
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'stock_prediction',
            schema: STOCK_RESPONSE_SCHEMA,
            strict: true,
          },
        },
        model: 'default',
        temperature: 0.2,
        maxTokens: 4000,
      });

      totalCost += result.costUsd;

      let parsed: any;
      try {
        parsed = JSON.parse(result.content ?? '{}');
      } catch {
        this.logger.warn('LLM stock response parsing failed for a batch');
        continue;
      }

      // Hydrater predictions
      for (const pred of parsed.predictions ?? []) {
        const p = productById.get(pred.productId);
        if (!p) continue;
        allPredictions.push({
          productId: pred.productId,
          productName: `${p.brand ?? ''} ${p.name}`.trim(),
          predictedUnits4Weeks: pred.predictedUnits4Weeks,
          predictedUnits12Weeks: pred.predictedUnits12Weeks,
          trend: pred.trend,
          confidence: pred.confidence,
        });
      }

      // Hydrater reorderSuggestions
      for (const r of parsed.reorderSuggestions ?? []) {
        const p = productById.get(r.productId);
        if (!p) continue;
        const currentStock = (p.stockItems as Array<{ quantity: number }>).reduce(
          (sum, si) => sum + si.quantity,
          0,
        );
        const unitCost = Number(p.costPriceHt ?? 0);
        allReorder.push({
          productId: r.productId,
          productName: `${p.brand ?? ''} ${p.name}`.trim(),
          currentStock,
          urgency: r.urgency,
          suggestedQuantity: r.suggestedQuantity,
          reasoning: r.reasoning,
          supplierName: p.supplier?.name ?? null,
          supplierId: p.supplier?.id ?? null,
          estimatedCost: Math.round(unitCost * r.suggestedQuantity * 100) / 100,
        });
      }

      // Hydrater deadStock
      for (const d of parsed.deadStockAlerts ?? []) {
        const p = productById.get(d.productId);
        if (!p) continue;
        const currentStock = (p.stockItems as Array<{ quantity: number }>).reduce(
          (sum, si) => sum + si.quantity,
          0,
        );
        allDeadStock.push({
          productId: d.productId,
          productName: `${p.brand ?? ''} ${p.name}`.trim(),
          weeksWithoutSale: d.weeksWithoutSale,
          currentStock,
          recommendedAction: d.recommendedAction,
        });
      }
    }

    // Tri : urgence puis valeur
    allReorder.sort((a, b) => {
      const order = { immediate: 0, within_7d: 1, within_30d: 2 };
      return order[a.urgency] - order[b.urgency] || b.estimatedCost - a.estimatedCost;
    });

    return {
      generatedAt: new Date().toISOString(),
      storeId: input.storeId ?? null,
      productCount: products.length,
      predictions: allPredictions,
      reorderSuggestions: allReorder,
      deadStockAlerts: allDeadStock,
      costUsd: totalCost,
    };
  }

  /**
   * Génère un brouillon de bon de commande groupé par fournisseur,
   * basé sur la prédiction. À VALIDER PAR L'OPTICIEN avant envoi.
   */
  async generatePurchaseOrderDraft(input: PredictStockInput): Promise<PurchaseOrderDraftResult> {
    const prediction = await this.predict(input);
    const warnings: string[] = [];

    // Filtrer : urgences immediate + within_7d (within_30d laissé à l'utilisateur)
    const toOrder = prediction.reorderSuggestions.filter(
      (r) => r.urgency === 'immediate' || r.urgency === 'within_7d',
    );

    // Charger SKU pour chaque produit
    const productIds = toOrder.map((r) => r.productId);
    const products = await this.prisma.product.findMany({
      where: { tenantId: input.tenantId, id: { in: productIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        costPriceHt: true,
        supplierId: true,
        supplier: { select: { id: true, name: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Grouper par supplier
    const draftMap = new Map<string, PurchaseOrderDraft>();
    let withoutSupplier = 0;

    for (const r of toOrder) {
      const p = byId.get(r.productId);
      if (!p) continue;
      if (!p.supplier) {
        withoutSupplier++;
        continue;
      }
      const key = p.supplier.id;
      const unitCost = Number(p.costPriceHt ?? 0);
      const lineTotal = Math.round(unitCost * r.suggestedQuantity * 100) / 100;

      let draft = draftMap.get(key);
      if (!draft) {
        draft = {
          supplierId: p.supplier.id,
          supplierName: p.supplier.name,
          estimatedCost: 0,
          items: [],
        };
        draftMap.set(key, draft);
      }
      draft.items.push({
        productId: r.productId,
        productName: r.productName,
        sku: p.sku,
        quantity: r.suggestedQuantity,
        unitCostHt: unitCost,
        lineTotalHt: lineTotal,
        urgency: r.urgency,
        reasoning: r.reasoning,
      });
      draft.estimatedCost = Math.round((draft.estimatedCost + lineTotal) * 100) / 100;
    }

    if (withoutSupplier > 0) {
      warnings.push(
        `${withoutSupplier} produit(s) à réapprovisionner n'ont pas de fournisseur attribué — assigner un fournisseur avant commande.`,
      );
    }
    if (draftMap.size === 0) {
      warnings.push('Aucun produit en urgence à réapprovisionner pour le moment.');
    }

    const drafts = Array.from(draftMap.values()).sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    );
    const totalEstimatedCost =
      Math.round(drafts.reduce((sum, d) => sum + d.estimatedCost, 0) * 100) / 100;

    return {
      generatedAt: new Date().toISOString(),
      drafts,
      totalEstimatedCost,
      warnings,
    };
  }
}
