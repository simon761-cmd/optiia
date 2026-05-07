import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';

import { PrismaService } from '../common/prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Signup d'un nouveau tenant + son OWNER + sa première boutique.
   * On crée tout dans une transaction pour garantir l'atomicité.
   */
  async signup(dto: SignupDto): Promise<AuthTokens> {
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.txn(async (tx) => {
      const existingTenant = await tx.tenant.findFirst({ where: { name: dto.companyName } });
      if (existingTenant) {
        throw new ConflictException('A tenant with this name already exists');
      }

      const existingUser = await tx.user.findFirst({ where: { email: dto.email } });
      if (existingUser) throw new ConflictException('Email already registered');

      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          locale: dto.locale ?? 'fr-FR',
          stores: {
            create: {
              name: dto.storeName ?? dto.companyName,
            },
          },
          // Trial 14 j sur plan Pro
          subscription: {
            create: {
              plan: SubscriptionPlan.PRO,
              status: SubscriptionStatus.TRIALING,
              trialEnd: new Date(Date.now() + 14 * 24 * 3600 * 1000),
            },
          },
          aiQuota: {
            create: {
              monthlyLimit: 1000,
              monthResetAt: this.firstDayNextMonth(),
              dailyResetAt: this.tomorrowMidnight(),
            },
          },
        },
        include: { stores: true },
      });

      const newUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.OWNER,
          stores: {
            create: { storeId: tenant.stores[0].id },
          },
        },
        include: { stores: true },
      });

      return newUser;
    });

    return this.issueTokens(user.id, user.tenantId, user.email, user.role, user.stores.map((s) => s.storeId));
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), isActive: true },
      include: { stores: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id, user.tenantId, user.email, user.role, user.stores.map((s) => s.storeId));
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { stores: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation : on révoque l'ancien et on en émet un nouveau
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const u = stored.user;
    return this.issueTokens(u.id, u.tenantId, u.email, u.role, u.stores.map((s) => s.storeId));
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  // ---------- helpers ----------

  private async issueTokens(
    userId: string,
    tenantId: string,
    email: string,
    role: UserRole,
    storeIds: string[],
  ): Promise<AuthTokens> {
    const payload = { sub: userId, tenantId, email, role, storeIds };

    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const ttlDays = this.parseDays(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 3600 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDays(ttl: string): number {
    const match = ttl.match(/^(\d+)d$/);
    if (!match) throw new BadRequestException('Invalid TTL format');
    return parseInt(match[1], 10);
  }

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
