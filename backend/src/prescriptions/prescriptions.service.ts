import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OcrService } from '../ai/services/ocr.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    private prisma: PrismaService,
    private ocr: OcrService,
  ) {}

  /**
   * Création manuelle d'une ordonnance (formulaire classique)
   */
  async createManual(tenantId: string, userId: string, dto: CreatePrescriptionDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    return this.prisma.prescription.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        type: dto.type ?? 'GLASSES',
        status: 'VALIDATED',
        doctorName: dto.doctorName ?? null,
        doctorRpps: dto.doctorRpps ?? null,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        odSphere: dto.od?.sphere ?? null,
        odCylinder: dto.od?.cylinder ?? null,
        odAxis: dto.od?.axis ?? null,
        odAddition: dto.od?.addition ?? null,
        ogSphere: dto.og?.sphere ?? null,
        ogCylinder: dto.og?.cylinder ?? null,
        ogAxis: dto.og?.axis ?? null,
        ogAddition: dto.og?.addition ?? null,
        pupillaryDistance: dto.pupillaryDistance ?? null,
        notes: dto.notes ?? null,
        validatedById: userId,
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.prescription.findMany({
      where: { tenantId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async listByClient(tenantId: string, clientId: string) {
    return this.prisma.prescription.findMany({
      where: { tenantId, clientId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, tenantId },
    });
    if (!prescription) throw new NotFoundException('Ordonnance introuvable');
    return prescription;
  }

  /**
   * Extraction OCR : reçoit une image (data URL base64), appelle GPT-4o vision,
   * et retourne les données structurées SANS créer l'ordonnance.
   * Le frontend pré-remplit le formulaire avec ça pour validation humaine.
   */
  async extractFromImage(tenantId: string, userId: string, imageDataUrl: string) {
    const result = await this.ocr.extractFromImage({
      tenantId,
      userId,
      imageUrl: imageDataUrl, // data URL base64
    });
    return {
      data: result,
    };
  }
}