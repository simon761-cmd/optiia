import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Vérifie qu'un appel IA peut être fait pour ce tenant.
   * Reset automatique des compteurs si la fenêtre est expirée.
   */
  async assertCanCall(tenantId: string): Promise<void> {
    const quota = await this.prisma.aiQuota.findUnique({ where: { tenantId } });
    if (!quota) {
      // Pas de quota défini = on bloque (sécurité par défaut)
      throw new ForbiddenException('AI quota not configured for this tenant');
    }

    const now = new Date();
    const updates: Record<string, any> = {};

    if (quota.monthResetAt < now) {
      updates.monthlyUsed = 0;
      updates.monthResetAt = this.firstDayNextMonth();
    }
    if (quota.dailyResetAt < now) {
      updates.dailyUsdSpent = 0;
      updates.dailyResetAt = this.tomorrowMidnight();
    }
    if (Object.keys(updates).length) {
      await this.prisma.aiQuota.update({ where: { tenantId }, data: updates });
    }

    const monthlyUsed = updates.monthlyUsed ?? quota.monthlyUsed;
    const dailySpent = updates.dailyUsdSpent ?? Number(quota.dailyUsdSpent);

    if (monthlyUsed >= quota.monthlyLimit) {
      throw new ForbiddenException(
        `Monthly AI quota reached (${monthlyUsed}/${quota.monthlyLimit}). Upgrade your plan.`,
      );
    }
    if (dailySpent >= Number(quota.hardDailyUsdCap)) {
      throw new ForbiddenException(
        `Daily AI spending cap reached. Quota resets tomorrow.`,
      );
    }
  }

  /**
   * Décompte 1 appel + ajoute le coût.
   * Atomique via update {increment}.
   */
  async recordUsage(tenantId: string, costUsd: number): Promise<void> {
    await this.prisma.aiQuota.update({
      where: { tenantId },
      data: {
        monthlyUsed: { increment: 1 },
        dailyUsdSpent: { increment: costUsd },
      },
    });
  }

  /**
   * Pour affichage dashboard.
   */
  async getStatus(tenantId: string) {
    const q = await this.prisma.aiQuota.findUnique({ where: { tenantId } });
    if (!q) return null;
    return {
      monthlyLimit: q.monthlyLimit,
      monthlyUsed: q.monthlyUsed,
      monthlyRemaining: Math.max(0, q.monthlyLimit - q.monthlyUsed),
      dailyUsdSpent: Number(q.dailyUsdSpent),
      dailyUsdCap: Number(q.hardDailyUsdCap),
      monthResetAt: q.monthResetAt,
    };
  }

  // ---------- helpers ----------
  private firstDayNextMonth(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  private tomorrowMidnight(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
