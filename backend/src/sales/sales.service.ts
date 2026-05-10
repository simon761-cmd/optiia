import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';

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

  async create(tenantId: string, _userId: string, storeId: string | undefined, dto: CreateSaleDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Un ou plusieurs produits introuvables');
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotalHt = 0;
    let totalTtc = 0;
    const itemsToCreate: any[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      const sellTtc = Number(product.sellPriceTtc);
      const vatRate = Number(product.vatRate);
      const unitPriceHt = sellTtc / (1 + vatRate / 100);
      const lineHt = unitPriceHt * item.quantity;
      const lineTtc = sellTtc * item.quantity;

      subtotalHt += lineHt;
      totalTtc += lineTtc;

      itemsToCreate.push({
        productId: product.id,
        description: `${product.brand ?? ''} ${product.name}`.trim(),
        quantity: item.quantity,
        unitPriceHt: unitPriceHt.toFixed(2),
        vatRate,
        totalHt: lineHt.toFixed(2),
        totalTtc: lineTtc.toFixed(2),
      });
    }

    const vatAmount = totalTtc - subtotalHt;

    const year = new Date().getFullYear();
    const prefix = `V-${year}-`;
    const lastSale = await this.prisma.sale.findFirst({
      where: { tenantId, reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
    });
    let nextNum = 1;
    if (lastSale) {
      const lastNum = parseInt(lastSale.reference.replace(prefix, ''), 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    const reference = `${prefix}${String(nextNum).padStart(5, '0')}`;

    const status = dto.status ?? 'PENDING';
    return this.prisma.sale.create({
      data: {
        tenantId,
        storeId: storeId ?? client.storeId!,
        clientId: dto.clientId,
        reference,
        status,
        subtotalHt: subtotalHt.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalTtc: totalTtc.toFixed(2),
        paidAmount: status === 'DELIVERED' ? totalTtc.toFixed(2) : '0',
        deliveredAt: status === 'DELIVERED' ? new Date() : null,
        items: { create: itemsToCreate },
      },
      include: {
        items: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}