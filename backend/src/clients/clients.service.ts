import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, storeId: string | undefined, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        tenantId,
        storeId: storeId ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        addressLine1: dto.addressLine1,
        postalCode: dto.postalCode,
        city: dto.city,
        notes: dto.notes,
        tags: dto.tags ?? [],
      },
    });
  }

  /**
   * Liste paginée avec recherche full-text simple sur nom/email/téléphone.
   * Pour aller plus loin : index GIN trigram pgtrgm + ranking.
   */
  async list(tenantId: string, query: ListClientsDto) {
    const { search, limit = 20, cursor, storeId } = query;
    const where: Prisma.ClientWhereInput = {
      tenantId,
      deletedAt: null,
      ...(storeId ? { storeId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const items = await this.prisma.client.findMany({
      where,
      take: limit + 1, // on en demande 1 de plus pour savoir s'il y a une page suivante
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  async findOne(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        prescriptions: {
          orderBy: { issuedAt: 'desc' },
          take: 10,
        },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPriceHt: true,
                totalTtc: true,
                product: { select: { name: true, brand: true, category: true } },
              },
            },
          },
        },
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const completedSales = client.sales.filter((s) => s.status !== 'CANCELLED');
    const totalSpend = completedSales.reduce((sum, s) => sum + Number(s.totalTtc), 0);
    const lastVisitAt = client.sales[0]?.createdAt ?? null;

    return {
      ...client,
      kpis: {
        totalSpend,
        salesCount: completedSales.length,
        lastVisitAt,
      },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto) {
    await this.assertExists(tenantId, id);
    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });
  }

  /**
   * Soft-delete RGPD : on marque deletedAt, on garde 90 jours.
   * Une tâche cron purgera physiquement les soft-deleted > 90j en anonymisant les ventes liées.
   */
  async remove(tenantId: string, id: string) {
    await this.assertExists(tenantId, id);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertExists(tenantId: string, id: string) {
    const exists = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Client not found');
  }
}
