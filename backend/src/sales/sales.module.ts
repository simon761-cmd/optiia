import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [PrismaModule],
  controllers: [SalesController],
  providers: [SalesService, InvoiceService],
  exports: [SalesService, InvoiceService],
})
export class SalesModule {}
