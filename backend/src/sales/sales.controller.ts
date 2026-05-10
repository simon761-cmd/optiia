import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller({ path: 'sales', version: '1' })
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

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

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.findOne(user.tenantId, id);
  }
}