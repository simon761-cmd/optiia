import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ListProductsParams {
  tenantId: string;
  search?: string;
  category?: string;
  limit?: number;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(params: ListProductsParams) {
    const limit = Math.min(params.limit ?? 100, 500);
    const where: any = {
      tenantId: params.tenantId,
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { brand: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { brand: 'asc' }, { name: 'asc' }],
      take: limit,
    });

    return { data: products };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }
}
