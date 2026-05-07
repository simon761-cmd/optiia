import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LlmService } from '../llm.service';
import {
  MARKETING_PROMPT_VERSION,
  MARKETING_SYSTEM_PROMPT,
  MARKETING_RESPONSE_SCHEMA_EMAIL,
  MARKETING_RESPONSE_SCHEMA_SMS,
  MarketingChannel,
  MarketingScenario,
  MarketingContext,
  buildMarketingUserMessage,
  SEGMENTATION_PROMPT_VERSION,
  SEGMENTATION_SYSTEM_PROMPT,
} from '../prompts/marketing.prompts';

export interface GenerateMessageInput {
  tenantId: string;
  userId: string;
  storeId?: string;
  clientId: string;
  channel: MarketingChannel;
  scenario: MarketingScenario;
  customNote?: string;
}

export interface GenerateMessageResult {
  channel: MarketingChannel;
  scenario: MarketingScenario;
  clientId: string;
  message:
    | { subject: string; body: string; previewText: string; cta: { label: string; intent: string } }
    | { message: string; characterCount: number };
  warnings: string[];
  costUsd: number;
}

export interface IdentifyTargetsInput {
  tenantId: string;
  userId: string;
  storeId?: string;
  scenarioFilter?: MarketingScenario;
  limit?: number;
}

export interface MarketingTarget {
  clientId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  priorityScore: number;
  suggestedScenario: MarketingScenario;
  reasoning: string;
  preferredChannel: MarketingChannel;
}

export interface IdentifyTargetsResult {
  generatedAt: string;
  candidatesScreened: number;
  targets: MarketingTarget[];
  costUsd: number;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  // ------------------------------------------------------------------
  // GÉNÉRATION DE MESSAGE
  // ------------------------------------------------------------------

  async generateMessage(input: GenerateMessageInput): Promise<GenerateMessageResult> {
    const warnings: string[] = [];

    // 1. Charger le client
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, tenantId: input.tenantId, deletedAt: null },
      include: {
        store: { select: { name: true, phone: true, addressLine1: true, postalCode: true, city: true } },
        sales: {
          where: { status: 'DELIVERED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            items: {
              take: 1,
              include: { product: { select: { brand: true, name: true } } },
            },
          },
        },
      },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    // 2. Garde-fous RGPD
    if (!client.marketingConsent) {
      throw new BadRequestException(
        "Le client n'a pas donné son consentement marketing. Impossible de générer un message commercial.",
      );
    }
    if (input.channel === 'email' && !client.email) {
      throw new BadRequestException("Le client n'a pas d'email enregistré.");
    }
    if (input.channel === 'sms' && !client.phone) {
      throw new BadRequestException("Le client n'a pas de téléphone enregistré.");
    }

    // 3. Construire le contexte
    const lastSale = client.sales[0];
    const lastItem = lastSale?.items[0];
    const lastProduct = lastItem?.product
      ? `${lastItem.product.brand ?? ''} ${lastItem.product.name}`.trim()
      : null;

    const age = client.birthDate ? this.computeAge(client.birthDate) : null;

    // Sélection du store : celui du client → fallback sur input.storeId → fallback sur premier store du tenant
    let storeInfo = client.store;
    if (!storeInfo && input.storeId) {
      storeInfo = await this.prisma.store.findFirst({
        where: { id: input.storeId, tenantId: input.tenantId },
        select: { name: true, phone: true, addressLine1: true, postalCode: true, city: true } as any,
      }) as any;
    }
    if (!storeInfo) {
      storeInfo = await this.prisma.store.findFirst({
        where: { tenantId: input.tenantId },
        select: { name: true, phone: true, addressLine1: true, postalCode: true, city: true } as any,
      }) as any;
    }
    if (!storeInfo) {
      throw new BadRequestException('Aucune boutique configurée pour ce tenant.');
    }

    const storeAddress = [storeInfo.addressLine1, storeInfo.postalCode, storeInfo.city]
      .filter(Boolean)
      .join(', ');

    const ctx: MarketingContext = {
      storeName: storeInfo.name,
      storePhone: storeInfo.phone ?? '',
      storeAddress,
      unsubscribeUrl:
        input.channel === 'email'
          ? `https://app.optiia.fr/unsubscribe/${input.clientId}`
          : undefined,
      scenario: input.scenario,
      channel: input.channel,
      customNote: input.customNote,
      locale: client.locale,
      client: {
        fullName: `${client.firstName} ${client.lastName}`,
        firstName: client.firstName,
        age,
        lastPurchaseDate: lastSale?.createdAt?.toISOString().slice(0, 10) ?? null,
        lastPurchaseProduct: lastProduct,
        totalLifetimeSpend: Number(client.totalLifetimeSpend),
        preferredCommunicationStyle: age !== null && age < 35 ? 'casual' : 'formal',
      },
    };

    // 4. Appel LLM
    const schema = input.channel === 'email' ? MARKETING_RESPONSE_SCHEMA_EMAIL : MARKETING_RESPONSE_SCHEMA_SMS;

    const result = await this.llm.complete({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: `marketing-${input.channel}`,
      promptVersion: MARKETING_PROMPT_VERSION,
      messages: [
        { role: 'system', content: MARKETING_SYSTEM_PROMPT },
        { role: 'user', content: buildMarketingUserMessage(ctx) },
      ],
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: `marketing_${input.channel}`, schema, strict: true },
      },
      model: 'default',
      temperature: 0.7,
      maxTokens: 800,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(result.content ?? '{}');
    } catch {
      throw new Error('Réponse LLM invalide');
    }

    // 5. Validation post-LLM
    if (input.channel === 'sms') {
      const len = (parsed.message ?? '').length;
      if (len > 160) warnings.push(`SMS dépasse 160 caractères (${len}). Sera segmenté en plusieurs SMS.`);
      if (!parsed.message?.toLowerCase().includes('stop')) {
        warnings.push("La mention obligatoire 'STOP' n'apparaît pas dans le SMS — vérifie avant envoi.");
      }
    }

    return {
      channel: input.channel,
      scenario: input.scenario,
      clientId: input.clientId,
      message: parsed,
      warnings,
      costUsd: result.costUsd,
    };
  }

  // ------------------------------------------------------------------
  // IDENTIFICATION DE CIBLES
  // ------------------------------------------------------------------

  async identifyTargets(input: IdentifyTargetsInput): Promise<IdentifyTargetsResult> {
    const limit = Math.min(input.limit ?? 30, 100);

    // 1. Pré-filtrage SQL : clients consentants avec données minimales,
    //    inactifs OU avec ordo > 3 ans OU anniversaire proche.
    const today = new Date();
    const threeYearsAgo = new Date(today);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const eighteenMonthsAgo = new Date(today);
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

    const candidates = await this.prisma.client.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        marketingConsent: true,
        ...(input.storeId ? { storeId: input.storeId } : {}),
        OR: [
          // Inactif > 18 mois mais a déjà acheté
          {
            lastVisitAt: { lt: eighteenMonthsAgo },
            totalLifetimeSpend: { gt: 0 },
          },
          // Ordonnance > 3 ans
          {
            prescriptions: {
              some: {
                issuedAt: { lt: threeYearsAgo },
                status: 'VALIDATED',
              },
            },
          },
          // Anniversaire dans les 14 prochains jours (filtre côté JS plus bas)
          { birthDate: { not: null } },
        ],
        AND: [{ OR: [{ email: { not: null } }, { phone: { not: null } }] }],
      },
      take: 300,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        birthDate: true,
        lastVisitAt: true,
        totalLifetimeSpend: true,
        prescriptions: {
          where: { status: 'VALIDATED' },
          orderBy: { issuedAt: 'desc' },
          take: 1,
          select: { issuedAt: true },
        },
      },
    });

    // 2. Calcul de "raisons" objectives par client
    const enriched = candidates.map((c) => {
      const reasons: string[] = [];
      const now = new Date();
      const lastVisit = c.lastVisitAt;
      const lastPrescription = c.prescriptions[0]?.issuedAt;
      const birth = c.birthDate;

      let monthsSinceVisit: number | null = null;
      if (lastVisit) {
        monthsSinceVisit = Math.floor(
          (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
        );
        if (monthsSinceVisit >= 18) reasons.push(`inactif depuis ${monthsSinceVisit} mois`);
      }

      let yearsSincePrescription: number | null = null;
      if (lastPrescription) {
        yearsSincePrescription = Math.floor(
          (now.getTime() - lastPrescription.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
        );
        if (yearsSincePrescription >= 3) reasons.push(`ordonnance ${yearsSincePrescription}+ ans`);
      }

      let daysToBirthday: number | null = null;
      if (birth) {
        const next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
        if (next.getTime() < now.getTime()) next.setFullYear(now.getFullYear() + 1);
        daysToBirthday = Math.floor((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToBirthday <= 14) reasons.push(`anniversaire dans ${daysToBirthday} jours`);
      }

      return {
        id: c.id,
        fullName: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone,
        totalLifetimeSpend: Number(c.totalLifetimeSpend),
        monthsSinceVisit,
        yearsSincePrescription,
        daysToBirthday,
        reasons,
      };
    });

    // Garder seulement ceux avec au moins une raison
    const filtered = enriched.filter((c) => c.reasons.length > 0);

    if (filtered.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        candidatesScreened: candidates.length,
        targets: [],
        costUsd: 0,
      };
    }

    // 3. LLM scoring sur le sous-ensemble (top 60 max envoyés au LLM)
    const toScore = filtered.slice(0, 60);

    const scoringSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['targets'],
      properties: {
        targets: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['clientId', 'priorityScore', 'suggestedScenario', 'reasoning', 'preferredChannel'],
            properties: {
              clientId: { type: 'string' },
              priorityScore: { type: 'integer', minimum: 0, maximum: 100 },
              suggestedScenario: {
                type: 'string',
                enum: [
                  'reactivation_inactive_client',
                  'prescription_renewal_due',
                  'birthday_offer',
                  'post_purchase_followup',
                  'new_collection_announcement',
                  'appointment_reminder',
                ],
              },
              reasoning: { type: 'string' },
              preferredChannel: { type: 'string', enum: ['email', 'sms'] },
            },
          },
        },
      },
    };

    const userMsg = `Voici ${toScore.length} clients consentants à scorer. Sélectionne au maximum ${limit} clients prioritaires.\n\n\`\`\`json\n${JSON.stringify(toScore, null, 2)}\n\`\`\`\n\nFiltre par scénario : ${input.scenarioFilter ?? 'aucun (tous scénarios)'}.\n\nPour chaque client retenu, propose le scénario qui colle le mieux à ses raisons. preferredChannel = "email" si email présent, sinon "sms".`;

    const result = await this.llm.complete({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'marketing-segmentation',
      promptVersion: SEGMENTATION_PROMPT_VERSION,
      messages: [
        { role: 'system', content: SEGMENTATION_SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'segmentation', schema: scoringSchema, strict: true },
      },
      model: 'default',
      temperature: 0.3,
      maxTokens: 3000,
    });

    let parsed: any = { targets: [] };
    try {
      parsed = JSON.parse(result.content ?? '{}');
    } catch {
      this.logger.warn('Segmentation parsing failed');
    }

    const byId = new Map(filtered.map((c) => [c.id, c]));
    const targets: MarketingTarget[] = (parsed.targets ?? [])
      .filter((t: any) => byId.has(t.clientId))
      .filter((t: any) => !input.scenarioFilter || t.suggestedScenario === input.scenarioFilter)
      .slice(0, limit)
      .map((t: any) => {
        const c = byId.get(t.clientId)!;
        // Garde-fou canal : si préférence email mais pas d'email, fallback sms (et inverse)
        let channel: MarketingChannel = t.preferredChannel;
        if (channel === 'email' && !c.email) channel = 'sms';
        if (channel === 'sms' && !c.phone) channel = 'email';
        return {
          clientId: t.clientId,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          priorityScore: t.priorityScore,
          suggestedScenario: t.suggestedScenario,
          reasoning: t.reasoning,
          preferredChannel: channel,
        };
      })
      .sort((a: MarketingTarget, b: MarketingTarget) => b.priorityScore - a.priorityScore);

    return {
      generatedAt: new Date().toISOString(),
      candidatesScreened: candidates.length,
      targets,
      costUsd: result.costUsd,
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private computeAge(birthDate: Date): number {
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
    return age;
  }
}
