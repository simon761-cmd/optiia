import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm.service';
import {
  OCR_PROMPT_VERSION,
  OCR_SYSTEM_PROMPT,
  OCR_RESPONSE_SCHEMA,
  OcrResult,
} from '../prompts/ocr.prompts';

export interface OcrInput {
  tenantId: string;
  userId: string;
  /** Soit une URL S3 signée, soit une dataURL base64 (data:image/jpeg;base64,…) */
  imageUrl: string;
}

export interface OcrOutput extends OcrResult {
  /** True si confiance >= seuil ET aucun warning critique */
  autoValidated: boolean;
  rawJson: string; // pour debug / audit
}

const MIN_AUTO_VALIDATE_CONFIDENCE = 0.85;

/**
 * Service d'OCR ordonnance.
 * Stratégie : un seul appel vision + JSON schema strict (pas de second pass).
 * Coût typique : ~$0.005 / ordonnance (gpt-4o vision low/high detail).
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  async extractFromImage(input: OcrInput): Promise<OcrOutput> {
    if (!input.imageUrl) {
      throw new BadRequestException('imageUrl requis');
    }

    const result = await this.llm.vision<OcrResult>({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'ocr.prescription',
      promptVersion: OCR_PROMPT_VERSION,
      systemPrompt: OCR_SYSTEM_PROMPT,
      imageUrl: input.imageUrl,
      schema: OCR_RESPONSE_SCHEMA,
    });

    // Validation post-OCR : sanity checks médicaux
    const sanityWarnings = this.runSanityChecks(result);
    const allWarnings = [...(result.warnings ?? []), ...sanityWarnings];

    if (!result.isPrescription) {
      this.logger.warn(
        `[OCR] Document refusé (pas une ordonnance) tenant=${input.tenantId}`,
      );
    }

    const autoValidated =
      result.isPrescription &&
      result.confidence >= MIN_AUTO_VALIDATE_CONFIDENCE &&
      allWarnings.length === 0;

    return {
      ...result,
      warnings: allWarnings,
      autoValidated,
      rawJson: JSON.stringify(result),
    };
  }

  /**
   * Sanity checks complémentaires côté code (l'IA peut se tromper sur des plages).
   */
  private runSanityChecks(r: OcrResult): string[] {
    const w: string[] = [];
    const checkEye = (eye: typeof r.rightEye, label: string) => {
      if (!eye) return;
      if (eye.sphere !== null && (eye.sphere < -25 || eye.sphere > 25)) {
        w.push(`${label}: sphère hors plage médicale (${eye.sphere})`);
      }
      if (eye.cylinder !== null && (eye.cylinder < -10 || eye.cylinder > 0.25)) {
        w.push(`${label}: cylindre hors plage attendue (${eye.cylinder})`);
      }
      if (eye.axis !== null && (eye.axis < 0 || eye.axis > 180)) {
        w.push(`${label}: axe hors plage 0-180° (${eye.axis})`);
      }
      if (eye.cylinder !== null && eye.cylinder !== 0 && eye.axis === null) {
        w.push(`${label}: cylindre non nul mais axe manquant`);
      }
      if (eye.addition !== null && (eye.addition < 0 || eye.addition > 4)) {
        w.push(`${label}: addition hors plage attendue (${eye.addition})`);
      }
    };
    checkEye(r.rightEye, 'OD');
    checkEye(r.leftEye, 'OG');

    if (r.prescribedAt) {
      const d = new Date(r.prescribedAt);
      if (isNaN(d.getTime())) w.push('Date prescription invalide');
      else if (d.getTime() > Date.now()) w.push('Date prescription dans le futur');
      else {
        const ageYears = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (ageYears > 5) w.push(`Ordonnance ancienne (${ageYears.toFixed(1)} ans)`);
      }
    }

    return w;
  }
}
