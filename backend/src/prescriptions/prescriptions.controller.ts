import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { ExtractOcrDto } from './dto/extract-ocr.dto';

@Controller({ path: 'prescriptions', version: '1' })
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('clientId') clientId?: string) {
    if (clientId) return this.prescriptions.listByClient(user.tenantId, clientId);
    return this.prescriptions.list(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prescriptions.findOne(user.tenantId, id);
  }

  @Post()
  createManual(@CurrentUser() user: AuthUser, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptions.createManual(user.tenantId, user.userId, dto);
  }

  /**
   * Étape OCR : reçoit l'image en base64, retourne les données extraites (sans création).
   * Le frontend pré-remplit le formulaire, l'utilisateur valide, puis appelle POST /prescriptions.
   */
  @Post('ocr/extract')
  extractOcr(@CurrentUser() user: AuthUser, @Body() dto: ExtractOcrDto) {
    return this.prescriptions.extractFromImage(user.tenantId, user.userId, dto.imageDataUrl);
  }
}