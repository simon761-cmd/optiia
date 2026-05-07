import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService } from '../llm.service';
import {
  SALES_PROMPT_VERSION,
  SALES_SYSTEM_PROMPT,
  SALES_RESPONSE_SCHEMA,
  SalesAnalysisInput,
  SalesPeriodMetrics,
  buildSalesUserMessage,
} from '../prompts/sales-analysis.prompts';

export interface AnalyzePeriodInput {
  tenantId: string;
  userId: string;
  storeId?: string;
  period: 'week' | 'month' | 'quarter';
  date?: Date;
}

export interface SalesAnalysisOutput {
  executiveSummary: string;
  highlights: { title: string; detail: string }[];
  attentionPoints: { title: string; detail: string; severity: string }[];
  recommendations: { action: string; expectedImpact: string; effort: string }[];
  healthScore: number;
  metrics: SalesAnalysisInput;
}

@Injectable()
export class SalesAnalysisService {
  private readonly logger = new Logger(SalesAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async analyze(input: AnalyzePeriodInput): Promise<SalesAnalysisOutput> {
    const { from, to, label } = this.computeRange(input.period, input.date ?? new Date());
    const { from: fromPrev, to: toPrev } = this.shiftRange(from, to, 'previous');
    const { from: fromYear, to: toYear } = this.shiftRange(from, to, 'year');

    const [current, previous, yearAgo, topProducts, bottomProducts, topClients, dailyRevenue] =
      await Promise.all([
        this.computeMetrics(input.tenantId, input.storeId, from, to),
        this.computeMetrics(input.tenantId, input.storeId, fromPrev, toPrev),
        this.computeMetrics(input.tenantId, input.storeId, fromYear, toYear),
        this.computeTopProducts(input.tenantId, input.storeId, from, to, 'desc', 5),
        this.computeTopProducts(input.tenantId, input.storeId, from, to, 'asc', 5),
        this.computeTopClients(input.tenantId, input.storeId, from, to, 5),
        this.computeDailyRevenue(input.tenantId, input.storeId, from, to),
      ]);

    const anomalies = this.detectAnomalies(dailyRevenue);

    const llmInput: SalesAnalysisInput = {
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), label },
      current,
      previous,
      yearAgo,
      topProducts,
      bottomProducts,
      topClients,
      dailyRevenue,
      anomalies,
    };

    const result = await this.llm.complete({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'sales.analysis',
      promptVersion: SALES_PROMPT_VERSION,
      model: 'default',
      temperature: 0.3,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'sales_analysis', strict: true, schema: SALES_RESPONSE_SCHEMA },
      },
      messages: [
        { role: 'system', content: SALES_SYSTEM_PROMPT },
        { role: 'user', content: buildSalesUserMessage(llmInput) },
      ],
    });

    if (!result.content) throw new Error('Analyse vide');
    const parsed = JSON.parse(result.content);
    return { ...parsed, metrics: llmInput };
  }

  // --- range helpers ---

  private computeRange(period: 'week' | 'month' | 'quarter', ref: Date) {
    const to = new Date(ref);
    to.setHours(23, 59, 59, 999);
    const from = new Date(ref);
    let label: string;
    if (period === 'week') {
      from.setDate(from.getDate() - 7);
      label = '7 derniers jours';
    } else if (period === 'month') {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      label = from.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } else {
      from.setMonth(from.getMonth() - 3);
      label = '3 derniers mois';
    }
    return { from, to, label };
  }

  private shiftRange(from: Date, to: Date, mode: 'previous' | 'year') {
    const span = to.getTime() - from.getTime();
    if (mode === 'previous') {
      return { from: new Date(from.getTime() - span), to: new Date(from.getTime() - 1) };
    }
    const f = new Date(from);
    const t = new Date(to);
    f.setFullYear(f.getFullYear() - 1);
    t.setFullYear(t.getFullYear() - 1);
    return { from: f, to: t };
  }

  // --- queries ---
  // NB: status=DELIVERED considéré "vente effective" (configurable dans une v2)

  private async computeMetrics(
    tenantId: string,
    storeId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<SalesPeriodMetrics> {
    const where: any = { tenantId, createdAt: { gte: from, lte: to }, status: 'DELIVERED' };
    if (storeId) where.storeId = storeId;

    const [agg, distinctClients, newClients, marginRow] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _sum: { totalTtc: true, subtotalHt: true },
        _count: { id: true },
      }),
      this.prisma.sale.findMany({
        where,
        select: { clientId: true },
        distinct: ['clientId'],
      }),
      this.prisma.client.count({
        where: { tenantId, createdAt: { gte: from, lte: to } },
      }),
      this.computeMarginForPeriod(tenantId, storeId, from, to),
    ]);

    const revenue = Number(agg._sum.totalTtc ?? 0);
    const margin = marginRow.margin;
    const tickets = agg._count.id;
    return {
      revenue,
      margin,
      marginRate: revenue > 0 ? (margin / revenue) * 100 : 0,
      ticketsCount: tickets,
      avgBasket: tickets > 0 ? revenue / tickets : 0,
      uniqueClients: distinctClients.length,
      newClients,
      conversionRate: null,
    };
  }

  private async computeMarginForPeriod(
    tenantId: string,
    storeId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<{ margin: number }> {
    const params: any[] = [tenantId, from, to];
    let storeClause = '';
    if (storeId) {
      params.push(storeId);
      storeClause = `AND s.store_id = $${params.length}`;
    }
    const rows = await this.prisma.$queryRawUnsafe<{ margin: number }[]>(
      `
      SELECT COALESCE(SUM(
        si.total_ht - (si.quantity * COALESCE(p.cost_price_ht, 0))
      ), 0)::float AS margin
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        AND s.status = 'DELIVERED'
        ${storeClause}
      `,
      ...params,
    );
    return { margin: Number(rows[0]?.margin ?? 0) };
  }

  private async computeTopProducts(
    tenantId: string,
    storeId: string | undefined,
    from: Date,
    to: Date,
    direction: 'asc' | 'desc',
    limit: number,
  ) {
    const params: any[] = [tenantId, from, to];
    let storeClause = '';
    if (storeId) {
      params.push(storeId);
      storeClause = `AND s.store_id = $${params.length}`;
    }
    const rows = await this.prisma.$queryRawUnsafe<{ name: string; revenue: number; units: number }[]>(
      `
      SELECT p.name,
             COALESCE(SUM(si.total_ttc), 0)::float AS revenue,
             COALESCE(SUM(si.quantity), 0)::int AS units
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        AND s.status = 'DELIVERED'
        ${storeClause}
      GROUP BY p.name
      ORDER BY revenue ${direction === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ${limit}
      `,
      ...params,
    );
    return rows.filter((r) => r.name).map((r) => ({ name: r.name, revenue: Number(r.revenue), units: Number(r.units) }));
  }

  private async computeTopClients(
    tenantId: string,
    storeId: string | undefined,
    from: Date,
    to: Date,
    limit: number,
  ) {
    const params: any[] = [tenantId, from, to];
    let storeClause = '';
    if (storeId) {
      params.push(storeId);
      storeClause = `AND s.store_id = $${params.length}`;
    }
    const rows = await this.prisma.$queryRawUnsafe<{ name: string; revenue: number; visits: number }[]>(
      `
      SELECT (c.first_name || ' ' || c.last_name) AS name,
             COALESCE(SUM(s.total_ttc), 0)::float AS revenue,
             COUNT(s.id)::int AS visits
      FROM sales s
      JOIN clients c ON c.id = s.client_id
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        AND s.status = 'DELIVERED'
        ${storeClause}
      GROUP BY c.id
      ORDER BY revenue DESC
      LIMIT ${limit}
      `,
      ...params,
    );
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue), visits: Number(r.visits) }));
  }

  private async computeDailyRevenue(
    tenantId: string,
    storeId: string | undefined,
    from: Date,
    to: Date,
  ) {
    const params: any[] = [tenantId, from, to];
    let storeClause = '';
    if (storeId) {
      params.push(storeId);
      storeClause = `AND store_id = $${params.length}`;
    }
    const rows = await this.prisma.$queryRawUnsafe<{ date: string; revenue: number }[]>(
      `
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
             COALESCE(SUM(total_ttc), 0)::float AS revenue
      FROM sales
      WHERE tenant_id = $1
        AND created_at BETWEEN $2 AND $3
        AND status = 'DELIVERED'
        ${storeClause}
      GROUP BY 1
      ORDER BY 1
      `,
      ...params,
    );
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
  }

  private detectAnomalies(daily: { date: string; revenue: number }[]) {
    if (daily.length < 7) return [];
    const values = daily.map((d) => d.revenue);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    const anomalies: { date: string; type: string; description: string }[] = [];
    daily.forEach((d) => {
      const z = std > 0 ? (d.revenue - mean) / std : 0;
      if (z < -2) {
        anomalies.push({
          date: d.date,
          type: 'low_revenue',
          description: `CA de ${d.revenue.toFixed(0)}€ vs moyenne ${mean.toFixed(0)}€ (z=${z.toFixed(2)})`,
        });
      } else if (z > 2) {
        anomalies.push({
          date: d.date,
          type: 'high_revenue',
          description: `Pic de CA ${d.revenue.toFixed(0)}€ vs moyenne ${mean.toFixed(0)}€`,
        });
      }
    });
    return anomalies;
  }
}
