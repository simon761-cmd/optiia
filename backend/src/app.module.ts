import { Module } from '@nestjs/common';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
// import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { ClientsModule } from './clients/clients.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { AiModule } from './ai/ai.module';
import { ProductsModule } from './products/products.module';
import { configValidationSchema } from './config/validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 60 },
    ]),
    // BullModule.forRoot({
    //   connection: { url: process.env.REDIS_URL },
    // }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    ClientsModule,
    SalesModule,
    ProductsModule,
    DashboardModule,
     PrescriptionsModule,
    AiModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
