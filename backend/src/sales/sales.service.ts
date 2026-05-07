import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ListSalesParams {
  tenantId: string;
  storeId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async list(params: ListSalesParams) {
    const limit = Math.min(params.limit ?? 50, 100);
    const where: any = {
      tenantId: params.tenantId,
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.fromDate || params.toDate
        ? {
            createdAt: {
              ...(params.fromDate ? { gte: params.fromDate } : {}),
              ...(params.toDate ? { lte: params.toDate } : {}),
            },
          }
        : {}),
    };

    const sales = await this.prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { id: true } },
      },
    });

    const hasMore = sales.length > limit;
    const data = hasMore ? sales.slice(0, limit) : sales;
    return {
      data: data.map((s) => ({
        id: s.id,
        reference: s.reference,
        status: s.status,
        totalTtc: s.totalTtc,
        paidAmount: s.paidAmount,
        createdAt: s.createdAt,
        deliveredAt: s.deliveredAt,
        client: s.client,
        itemsCount: s.items.length,
      })),
      nextCursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  async getStats(tenantId: string, storeId?: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const where: any = {
      tenantId,
      ...(storeId ? { storeId } : {}),
      status: { not: 'CANCELLED' },
      createdAt: { gte: startOfMonth },
    };

    const [agg, pending, ready] = await Promise.all([
      this.prisma.sale.aggregate({
        _sum: { totalTtc: true },
        _avg: { totalTtc: true },
        _count: true,
        where,
      }),
      this.prisma.sale.count({
        where: { tenantId, ...(storeId ? { storeId } : {}), status: 'PENDING' },
      }),
      this.prisma.sale.count({
        where: { tenantId, ...(storeId ? { storeId } : {}), status: 'READY' },
      }),
    ]);

    return {
      revenueMonth: Number(agg._sum.totalTtc ?? 0),
      salesMonth: agg._count,
      averageBasket: Number(agg._avg.totalTtc ?? 0),
      pendingCount: pending,
      readyCount: ready,
    };
  }

  async findOne(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        items: { include: { product: true } },
        payments: true,
      },
    });
    if (!sale) throw new NotFoundException('Vente introuvable');
    return sale;
  }
}