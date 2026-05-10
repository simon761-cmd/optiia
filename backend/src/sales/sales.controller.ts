import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { InvoiceService } from './invoice.service';

@Controller({ path: 'sales', version: '1' })
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly invoices: InvoiceService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.sales.create(user.tenantId, user.userId, undefined, dto);
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.sales.getStats(user.tenantId, storeId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.sales.list({
      tenantId: user.tenantId,
      storeId,
      status,
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get(':id/invoice')
  async downloadInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const [pdfBuffer, sale] = await Promise.all([
      this.invoices.generateInvoicePdf(user.tenantId, id),
      this.sales.findOne(user.tenantId, id),
    ]);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture-${sale.reference}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.send(pdfBuffer);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.findOne(user.tenantId, id);
  }
}
