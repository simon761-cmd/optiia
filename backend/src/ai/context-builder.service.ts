import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ChatContext {
  tenantId: string;
  storeId?: string;
  userId: string;
  userName: string;
  userRole: string;
  storeName: string;
  locale: string;
  today: string;
  kpiSnapshot: {
    salesToday: number;
    salesMonth: number;
    avgBasket: number;
    pendingOrders: number;
    lowStockItems: number;
  };
}

@Injectable()
export class ContextBuilderService {
  constructor(private prisma: PrismaService) {}

  /**
   * Construit un contexte synthétique pour le prompt système du chat.
   * Cache Redis 5 min recommandé en production sur kpiSnapshot.
   */
  async buildChatContext(params: {
    tenantId: string;
    storeId?: string;
    userId: string;
  }): Promise<ChatContext> {
    const [user, store, kpis] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { firstName: true, lastName: true, role: true },
      }),
      params.storeId
        ? this.prisma.store.findUnique({ where: { id: params.storeId }, select: { name: true } })
        : null,
      this.computeKpiSnapshot(params.tenantId, params.storeId),
    ]);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { locale: true, name: true },
    });

    return {
      tenantId: params.tenantId,
      storeId: params.storeId,
      userId: params.userId,
      userName: user ? `${user.firstName} ${user.lastName}` : 'Utilisateur',
      userRole: user?.role ?? 'EMPLOYEE',
      storeName: store?.name ?? tenant?.name ?? 'Boutique',
      locale: tenant?.locale ?? 'fr-FR',
      today: new Date().toISOString().slice(0, 10),
      kpiSnapshot: kpis,
    };
  }

  private async computeKpiSnapshot(tenantId: string, storeId?: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const where = { tenantId, ...(storeId ? { storeId } : {}) };

    const [salesToday, salesMonth, pendingOrders, lowStockItems] = await Promise.all([
      this.prisma.sale.aggregate({
        _sum: { totalTtc: true },
        _count: true,
        where: { ...where, createdAt: { gte: startOfDay }, status: { not: 'CANCELLED' } },
      }),
      this.prisma.sale.aggregate({
        _sum: { totalTtc: true },
        _count: true,
        where: { ...where, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
      }),
      this.prisma.sale.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.stockItem.count({
        where: {
          tenantId,
          ...(storeId ? { storeId } : {}),
          quantity: { lte: this.prisma.stockItem.fields.reorderPoint as any }, // approximation : à raffiner avec raw query
        },
      }),
    ]);

    const monthCount = salesMonth._count;
    const monthTotal = Number(salesMonth._sum.totalTtc ?? 0);
    return {
      salesToday: Number(salesToday._sum.totalTtc ?? 0),
      salesMonth: monthTotal,
      avgBasket: monthCount > 0 ? monthTotal / monthCount : 0,
      pendingOrders,
      lowStockItems,
    };
  }
}
