/**
 * Prompts OCR ordonnance.
 * Versionnés pour pouvoir A/B-tester sans régression.
 */

export const OCR_PROMPT_VERSION = 'ocr-prescription@1.1.0';

export const OCR_SYSTEM_PROMPT = `
Tu es un système d'extraction médicale spécialisé dans la lecture des ordonnances ophtalmologiques françaises et européennes.

# Mission
Extraire les données structurées d'une ordonnance pour lunettes ou lentilles à partir d'une image.

# Données à extraire
Pour CHAQUE œil (œil droit = OD, œil gauche = OG) :
- sphere : sphère en dioptries (nombre signé, ex: -2.25, +1.50)
- cylinder : cylindre en dioptries (nombre négatif ou nul, ex: -0.75, 0)
- axis : axe en degrés (entier 0-180, requis si cylinder ≠ 0)
- addition : addition pour vision de près (nombre positif ou null, ex: +2.00 pour presbytie)

Et globalement :
- prescriberName : nom du prescripteur (ophtalmologiste)
- prescriberRpps : numéro RPPS si visible (11 chiffres)
- patientName : nom du patient si visible
- prescribedAt : date de prescription au format ISO YYYY-MM-DD
- prescriptionType : "GLASSES" | "CONTACT_LENSES" | "BOTH"
- pupillaryDistance : écart pupillaire en mm si présent (ex: 62)
- notes : remarques du prescripteur (verres progressifs, anti-reflet, photochromiques…)

# Règles strictes
1. N'INVENTE JAMAIS de valeur. Si une donnée est absente ou illisible, mets null.
2. Donne un score de confiance global entre 0 et 1.
3. Liste dans "warnings" toute anomalie : valeur hors plage médicale plausible (sphère hors [-25, +25], cylindre hors [-10, 0], axe hors [0, 180]), document non-ordonnance, écriture illisible, date manquante.
4. Si le document n'est PAS une ordonnance optique, mets "isPrescription": false et confidence: 0.
5. Préserve le signe : les valeurs notées sans signe sur l'ordonnance sont positives par convention.
6. Une notation "Plan" ou "0.00" pour la sphère = 0.

# Format
Tu réponds STRICTEMENT en JSON conforme au schéma fourni. Aucun texte hors JSON.
`.trim();

/**
 * JSON Schema strict utilisé avec response_format json_schema.
 * Tous les champs sont required (strict mode), nullable via type union.
 */
export const OCR_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isPrescription',
    'confidence',
    'rightEye',
    'leftEye',
    'prescriberName',
    'prescriberRpps',
    'patientName',
    'prescribedAt',
    'prescriptionType',
    'pupillaryDistance',
    'notes',
    'warnings',
  ],
  properties: {
    isPrescription: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rightEye: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['sphere', 'cylinder', 'axis', 'addition'],
      properties: {
        sphere: { type: ['number', 'null'] },
        cylinder: { type: ['number', 'null'] },
        axis: { type: ['integer', 'null'] },
        addition: { type: ['number', 'null'] },
      },
    },
    leftEye: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['sphere', 'cylinder', 'axis', 'addition'],
      properties: {
        sphere: { type: ['number', 'null'] },
        cylinder: { type: ['number', 'null'] },
        axis: { type: ['integer', 'null'] },
        addition: { type: ['number', 'null'] },
      },
    },
    prescriberName: { type: ['string', 'null'] },
    prescriberRpps: { type: ['string', 'null'] },
    patientName: { type: ['string', 'null'] },
    prescribedAt: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD' },
    prescriptionType: {
      type: ['string', 'null'],
      enum: ['GLASSES', 'CONTACT_LENSES', 'BOTH', null],
    },
    pupillaryDistance: { type: ['number', 'null'] },
    notes: { type: ['string', 'null'] },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

export interface OcrResult {
  isPrescription: boolean;
  confidence: number;
  rightEye: { sphere: number | null; cylinder: number | null; axis: number | null; addition: number | null } | null;
  leftEye: { sphere: number | null; cylinder: number | null; axis: number | null; addition: number | null } | null;
  prescriberName: string | null;
  prescriberRpps: string | null;
  patientName: string | null;
  prescribedAt: string | null;
  prescriptionType: 'GLASSES' | 'CONTACT_LENSES' | 'BOTH' | null;
  pupillaryDistance: number | null;
  notes: string | null;
  warnings: string[];
}
