import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(tenantId: string, storeId?: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const storeFilter = storeId ? { storeId } : {};

    const [
      todayAgg,
      monthAgg,
      activeClients,
      revenueByMonthRaw,
      topProductsRaw,
      revenueByCategoryRaw,
      lowStock,
      upcomingAppointments,
    ] = await Promise.all([
      // KPI aujourd'hui
      this.prisma.sale.aggregate({
        _sum: { totalTtc: true },
        _count: true,
        where: { tenantId, ...storeFilter, createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
      }),

      // KPI mois
      this.prisma.sale.aggregate({
        _sum: { totalTtc: true },
        _avg: { totalTtc: true },
        _count: true,
        where: { tenantId, ...storeFilter, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
      }),

      // Clients actifs 90j
      this.prisma.sale.findMany({
        where: { tenantId, ...storeFilter, createdAt: { gte: ninetyDaysAgo }, status: { not: 'CANCELLED' } },
        select: { clientId: true },
        distinct: ['clientId'],
      }),

      // CA par mois (12 mois)
      this.prisma.$queryRawUnsafe<Array<{ month: string; revenue: number; count: number }>>(
        `
        SELECT TO_CHAR(s."createdAt", 'YYYY-MM') AS month,
               SUM(s."totalTtc")::float AS revenue,
               COUNT(*)::int AS count
        FROM "Sale" s
        WHERE s."tenantId" = $1
          AND s."createdAt" >= $2
          AND s.status != 'CANCELLED'
          ${storeId ? `AND s."storeId" = $3` : ''}
        GROUP BY month
        ORDER BY month ASC
        `,
        tenantId,
        twelveMonthsAgo,
        ...(storeId ? [storeId] : []),
      ),

      // Top 5 produits ce mois
      this.prisma.$queryRawUnsafe<Array<{ id: string; name: string; qty: number; revenue: number }>>(
        `
        SELECT p.id, p.name, SUM(si.quantity)::int AS qty, SUM(si."totalTtc")::float AS revenue
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "Product" p ON p.id = si."productId"
        WHERE s."tenantId" = $1
          AND s."createdAt" >= $2
          AND s.status != 'CANCELLED'
          ${storeId ? `AND s."storeId" = $3` : ''}
        GROUP BY p.id
        ORDER BY qty DESC
        LIMIT 5
        `,
        tenantId,
        monthStart,
        ...(storeId ? [storeId] : []),
      ),

      // CA par catégorie ce mois
      this.prisma.$queryRawUnsafe<Array<{ category: string; revenue: number }>>(
        `
        SELECT p.category, SUM(si."totalTtc")::float AS revenue
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "Product" p ON p.id = si."productId"
        WHERE s."tenantId" = $1
          AND s."createdAt" >= $2
          AND s.status != 'CANCELLED'
          ${storeId ? `AND s."storeId" = $3` : ''}
        GROUP BY p.category
        ORDER BY revenue DESC
        `,
        tenantId,
        monthStart,
        ...(storeId ? [storeId] : []),
      ),

      // Stock bas
      this.prisma.$queryRawUnsafe<Array<{ id: string; name: string; quantity: number; reorderPoint: number }>>(
        `
        SELECT p.id, p.name, si.quantity::int, si."reorderPoint"::int
        FROM "StockItem" si
        JOIN "Product" p ON p.id = si."productId"
        WHERE si."tenantId" = $1
          AND si.quantity <= si."reorderPoint"
          ${storeId ? `AND si."storeId" = $2` : ''}
        ORDER BY (si.quantity::float / NULLIF(si."reorderPoint", 0)) ASC
        LIMIT 10
        `,
        tenantId,
        ...(storeId ? [storeId] : []),
      ),

      // RDV à venir 7 jours
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          ...storeFilter,
          startsAt: { gte: now, lte: sevenDaysLater },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: { client: { select: { firstName: true, lastName: true } } },
        orderBy: { startsAt: 'asc' },
        take: 10,
      }),
    ]);

    return {
      kpis: {
        revenueToday: Number(todayAgg._sum.totalTtc ?? 0),
        salesToday: todayAgg._count,
        revenueMonth: Number(monthAgg._sum.totalTtc ?? 0),
        salesMonth: monthAgg._count,
        averageBasket: Number(monthAgg._avg.totalTtc ?? 0),
        activeClients: activeClients.length,
      },
      revenueByMonth: revenueByMonthRaw,
      topProducts: topProductsRaw,
      revenueByCategory: revenueByCategoryRaw,
      lowStock,
      upcomingAppointments: upcomingAppointments.map((a) => ({
        id: a.id,
        clientName: `${a.client.firstName} ${a.client.lastName}`,
        type: a.type,
        startsAt: a.startsAt,
        status: a.status,
      })),
    };
  }
}
