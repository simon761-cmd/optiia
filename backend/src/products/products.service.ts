import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
      isActive: true,
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
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    return { data: products };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, isActive: true },
      include: { supplier: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { tenantId, sku: dto.sku, isActive: true },
    });
    if (existing) {
      throw new ConflictException(`Un produit avec le SKU "${dto.sku}" existe déjà`);
    }

    return this.prisma.product.create({
      data: {
        tenantId,
        sku: dto.sku,
        name: dto.name,
        brand: dto.brand ?? null,
        category: dto.category,
        subcategory: dto.subcategory ?? null,
        sellPriceTtc: dto.sellPriceTtc,
        costPriceHt: dto.costPriceHt ?? null,
        vatRate: dto.vatRate ?? 20,
        frameMaterial: dto.frameMaterial ?? null,
        frameColor: dto.frameColor ?? null,
        frameShape: dto.frameShape ?? null,
        frameSize: dto.frameSize ?? null,
        lensIndex: dto.lensIndex ?? null,
        lensTreatment: dto.lensTreatment ?? [],
        supplierId: dto.supplierId ?? null,
      } as any,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable');

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { tenantId, sku: dto.sku, isActive: true, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Un produit avec le SKU "${dto.sku}" existe déjà`);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.brand !== undefined && { brand: dto.brand || null }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.subcategory !== undefined && { subcategory: dto.subcategory || null }),
        ...(dto.sellPriceTtc !== undefined && { sellPriceTtc: dto.sellPriceTtc }),
        ...(dto.costPriceHt !== undefined && { costPriceHt: dto.costPriceHt }),
        ...(dto.vatRate !== undefined && { vatRate: dto.vatRate }),
        ...(dto.frameMaterial !== undefined && { frameMaterial: dto.frameMaterial || null }),
        ...(dto.frameColor !== undefined && { frameColor: dto.frameColor || null }),
        ...(dto.frameShape !== undefined && { frameShape: dto.frameShape || null }),
        ...(dto.frameSize !== undefined && { frameSize: dto.frameSize || null }),
        ...(dto.lensIndex !== undefined && { lensIndex: dto.lensIndex }),
        ...(dto.lensTreatment !== undefined && { lensTreatment: dto.lensTreatment }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId || null }),
      } as any,
    });
  }

  async softDelete(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable');

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
