import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService } from '../llm.service';
import {
  CLIENT_SUMMARY_PROMPT_VERSION,
  CLIENT_SUMMARY_SYSTEM_PROMPT,
  CLIENT_SUMMARY_RESPONSE_SCHEMA,
  ClientSummaryInput,
  buildClientSummaryUserMessage,
} from '../prompts/client-summary.prompts';

const CACHE_TTL_HOURS = 24;
const INSIGHT_KIND = 'summary';

export interface SummarizeInput {
  tenantId: string;
  userId: string;
  clientId: string;
  forceRefresh?: boolean;
}

export interface ClientSummaryPayload {
  profile: string;
  vision: string;
  purchaseHabits: string;
  preferences: string;
  recommendations: { action: string; rationale: string }[];
  tags: string[];
  segment: 'VIP' | 'fidele' | 'occasionnel' | 'nouveau' | 'a_relancer' | 'inactif';
}

export interface SummarizeResult {
  clientId: string;
  cached: boolean;
  generatedAt: string;
  expiresAt: string | null;
  payload: ClientSummaryPayload;
  costUsd: number;
}

@Injectable()
export class ClientSummaryService {
  private readonly logger = new Logger(ClientSummaryService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  async summarize(input: SummarizeInput): Promise<SummarizeResult> {
    // 1. Cache : récupérer le dernier insight summary non expiré
    if (!input.forceRefresh) {
      const cached = await this.prisma.clientInsight.findFirst({
        where: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          kind: INSIGHT_KIND,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { generatedAt: 'desc' },
      });
      if (cached) {
        return {
          clientId: input.clientId,
          cached: true,
          generatedAt: cached.generatedAt.toISOString(),
          expiresAt: cached.expiresAt?.toISOString() ?? null,
          payload: cached.payload as unknown as ClientSummaryPayload,
          costUsd: 0,
        };
      }
    }

    // 2. Charger les données complètes du client
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, tenantId: input.tenantId, deletedAt: null },
      include: {
        prescriptions: {
          where: { status: { in: ['VALIDATED', 'PENDING_REVIEW'] } },
          orderBy: { issuedAt: 'desc' },
          take: 5,
        },
        sales: {
          where: { status: { in: ['DELIVERED', 'READY'] } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, brand: true, category: true },
                },
              },
            },
          },
        },
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 10,
          select: { startsAt: true, type: true, status: true },
        },
      },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    // 3. Construire le payload pour le LLM
    const age = client.birthDate ? this.computeAge(client.birthDate) : null;

    const payload: ClientSummaryInput = {
      client: {
        id: client.id,
        fullName: `${client.firstName} ${client.lastName}`,
        age,
        gender: client.gender,
        createdAt: client.createdAt.toISOString().slice(0, 10),
        locale: client.locale,
      },
      prescriptions: client.prescriptions.map((p) => ({
        prescribedAt: (p.issuedAt ?? p.createdAt).toISOString().slice(0, 10),
        type: p.type,
        od:
          p.odSphere !== null || p.odCylinder !== null || p.odAxis !== null || p.odAddition !== null
            ? {
                sphere: p.odSphere !== null ? Number(p.odSphere) : null,
                cylinder: p.odCylinder !== null ? Number(p.odCylinder) : null,
                axis: p.odAxis ?? null,
                addition: p.odAddition !== null ? Number(p.odAddition) : null,
              }
            : null,
        og:
          p.ogSphere !== null || p.ogCylinder !== null || p.ogAxis !== null || p.ogAddition !== null
            ? {
                sphere: p.ogSphere !== null ? Number(p.ogSphere) : null,
                cylinder: p.ogCylinder !== null ? Number(p.ogCylinder) : null,
                axis: p.ogAxis ?? null,
                addition: p.ogAddition !== null ? Number(p.ogAddition) : null,
              }
            : null,
      })),
      purchases: client.sales.map((s) => ({
        date: s.createdAt.toISOString().slice(0, 10),
        items: s.items.map((it) => ({
          name: it.product?.name ?? it.description ?? 'Article',
          category: it.product?.category ?? 'OTHER',
          brand: it.product?.brand ?? null,
          price: Number(it.unitPriceHt),
        })),
        total: Number(s.totalTtc),
      })),
      appointments: client.appointments.map((a) => ({
        date: a.startsAt.toISOString().slice(0, 10),
        type: a.type,
        status: a.status,
      })),
      notes: client.notes ? [client.notes] : [],
    };

    // 4. Appel LLM
    const result = await this.llm.complete({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'client-summary',
      promptVersion: CLIENT_SUMMARY_PROMPT_VERSION,
      messages: [
        { role: 'system', content: CLIENT_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: buildClientSummaryUserMessage(payload) },
      ],
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'client_summary',
          schema: CLIENT_SUMMARY_RESPONSE_SCHEMA,
          strict: true,
        },
      },
      model: 'default',
      temperature: 0.3,
      maxTokens: 1200,
    });

    let parsed: ClientSummaryPayload;
    try {
      parsed = JSON.parse(result.content ?? '{}');
    } catch {
      throw new Error('Le LLM a renvoyé un JSON invalide');
    }

    // 5. Persister dans ClientInsight (cache 24h)
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.clientInsight.create({
      data: {
        tenantId: input.tenantId,
        clientId: input.clientId,
        kind: INSIGHT_KIND,
        payload: parsed as any,
        promptVersion: CLIENT_SUMMARY_PROMPT_VERSION,
        generatedAt,
        expiresAt,
      },
    });

    // Invalider/nettoyer les anciens insights summary expirés (best effort, async)
    void this.prisma.clientInsight
      .deleteMany({
        where: {
          tenantId: input.tenantId,
          clientId: input.clientId,
          kind: INSIGHT_KIND,
          expiresAt: { lt: new Date() },
        },
      })
      .catch(() => undefined);

    return {
      clientId: input.clientId,
      cached: false,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      payload: parsed,
      costUsd: result.costUsd,
    };
  }

  private computeAge(birthDate: Date): number {
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
    return age;
  }
}
