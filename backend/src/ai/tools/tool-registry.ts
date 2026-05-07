import { Injectable } from '@nestjs/common';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ToolContext {
  tenantId: string;
  storeId?: string;
  userId: string;
}

export interface Tool {
  definition: ChatCompletionTool;
  execute: (args: any, ctx: ToolContext) => Promise<any>;
}

/**
 * Registre central des tools exposés au LLM.
 * CHAQUE tool DOIT filtrer par tenantId — c'est la règle d'or pour le multi-tenant.
 */
@Injectable()
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(private prisma: PrismaService) {
    this.registerCoreTools();
  }

  private registerCoreTools() {
    // -------- Clients --------
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'find_inactive_clients',
          description:
            "Trouve les clients qui n'ont pas effectué d'achat depuis un certain nombre de mois.",
          parameters: {
            type: 'object',
            properties: {
              months_threshold: { type: 'integer', minimum: 1, maximum: 60 },
              limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            },
            required: ['months_threshold'],
          },
        },
      },
      execute: async (args, ctx) => {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - args.months_threshold);

        // Clients dont la dernière vente est antérieure à cutoff (ou aucune vente)
        const clients = await this.prisma.client.findMany({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
            sales: {
              none: { createdAt: { gte: cutoff } },
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            sales: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, totalTtc: true } },
          },
          take: args.limit ?? 10,
        });

        return clients.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
          lastPurchaseAt: c.sales[0]?.createdAt ?? null,
          lastPurchaseAmount: c.sales[0]?.totalTtc ?? null,
        }));
      },
    });

    // -------- KPI --------
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'get_store_kpi',
          description: 'Retourne les KPI principaux du magasin sur la période demandée.',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['today', 'week', 'month', 'year'] },
            },
            required: ['period'],
          },
        },
      },
      execute: async (args, ctx) => {
        const start = this.startOfPeriod(args.period);
        const where: any = {
          tenantId: ctx.tenantId,
          ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
          createdAt: { gte: start },
          status: { not: 'CANCELLED' },
        };
        const agg = await this.prisma.sale.aggregate({
          _sum: { totalTtc: true },
          _avg: { totalTtc: true },
          _count: true,
          where,
        });
        return {
          period: args.period,
          revenue_ttc: Number(agg._sum.totalTtc ?? 0),
          sales_count: agg._count,
          average_basket: Number(agg._avg.totalTtc ?? 0),
        };
      },
    });

    // -------- Top produits --------
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'get_top_selling_products',
          description: 'Liste les produits les plus vendus sur une période.',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['week', 'month', 'quarter'] },
              limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
            },
            required: ['period'],
          },
        },
      },
      execute: async (args, ctx) => {
        const start = this.startOfPeriod(args.period);
        const result: any[] = await this.prisma.$queryRawUnsafe(
          `
          SELECT p.id, p.name, p.brand, SUM(si.quantity)::int AS qty, SUM(si."totalTtc") AS revenue
          FROM "SaleItem" si
          JOIN "Sale" s ON s.id = si."saleId"
          JOIN "Product" p ON p.id = si."productId"
          WHERE s."tenantId" = $1
            AND s."createdAt" >= $2
            AND s.status != 'CANCELLED'
            ${ctx.storeId ? `AND s."storeId" = $3` : ''}
          GROUP BY p.id
          ORDER BY qty DESC
          LIMIT ${args.limit ?? 5};
          `,
          ctx.tenantId,
          start,
          ...(ctx.storeId ? [ctx.storeId] : []),
        );
        return result;
      },
    });

    // -------- Stock bas --------
    this.register({
      definition: {
        type: 'function',
        function: {
          name: 'get_low_stock_items',
          description: 'Retourne les produits dont le stock est sous le seuil de réapprovisionnement.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            },
          },
        },
      },
      execute: async (args, ctx) => {
        const result: any[] = await this.prisma.$queryRawUnsafe(
          `
          SELECT p.id, p.name, p.brand, si.quantity, si."reorderPoint" AS threshold
          FROM "StockItem" si
          JOIN "Product" p ON p.id = si."productId"
          WHERE si."tenantId" = $1
            AND si.quantity <= si."reorderPoint"
            ${ctx.storeId ? `AND si."storeId" = $2` : ''}
          ORDER BY (si.quantity::float / NULLIF(si."reorderPoint", 0)) ASC
          LIMIT ${args.limit ?? 20};
          `,
          ctx.tenantId,
          ...(ctx.storeId ? [ctx.storeId] : []),
        );
        return result;
      },
    });
  }

  register(tool: Tool) {
    this.tools.set(tool.definition.function.name, tool);
  }

  getDefinitions(): ChatCompletionTool[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(name: string, args: any, ctx: ToolContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.execute(args, ctx);
  }

  private startOfPeriod(period: string): Date {
    const d = new Date();
    switch (period) {
      case 'today': d.setHours(0, 0, 0, 0); return d;
      case 'week': {
        const day = (d.getDay() + 6) % 7; // lundi = 0
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'month': return new Date(d.getFullYear(), d.getMonth(), 1);
      case 'quarter': {
        const q = Math.floor(d.getMonth() / 3) * 3;
        return new Date(d.getFullYear(), q, 1);
      }
      case 'year': return new Date(d.getFullYear(), 0, 1);
      default: return d;
    }
  }
}
