/**
 * Prompts pour le module marketing CRM (emails / SMS).
 */

export const MARKETING_PROMPT_VERSION = 'marketing-message@1.0.0';

export type MarketingChannel = 'email' | 'sms';
export type MarketingScenario =
  | 'reactivation_inactive_client' // client inactif > 18 mois
  | 'prescription_renewal_due'     // ordonnance > 3 ans, à renouveler
  | 'birthday_offer'
  | 'post_purchase_followup'        // 7 jours après achat
  | 'new_collection_announcement'
  | 'appointment_reminder';

export interface MarketingClientSnapshot {
  fullName: string;
  firstName: string;
  age: number | null;
  lastPurchaseDate: string | null; // ISO
  lastPurchaseProduct: string | null;
  totalLifetimeSpend: number;
  preferredCommunicationStyle?: 'formal' | 'casual';
}

export interface MarketingContext {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  unsubscribeUrl?: string;
  scenario: MarketingScenario;
  channel: MarketingChannel;
  client: MarketingClientSnapshot;
  customNote?: string; // ex: "promo -20% sur solaires"
  locale: string;
}

export const MARKETING_SYSTEM_PROMPT = `
Tu es un copywriter spécialisé dans le marketing relationnel d'opticiens indépendants français.

# Mission
Rédiger un message court, chaleureux et efficace pour un client, dans le canal demandé (email ou SMS).

# Règles SMS
- Maximum 160 caractères (1 segment).
- Pas d'emojis sauf si demandé explicitement.
- Identifier l'expéditeur (nom du magasin) en début OU fin.
- Inclure une mention légale courte si scénario commercial : "STOP au [numéro]" obligatoire en France pour la prospection.

# Règles Email
- Sujet de 30-50 caractères, accrocheur sans être racoleur.
- Corps : 3-5 paragraphes courts, ton naturel.
- Toujours signer avec le nom du magasin.
- Inclure un CTA clair (un seul).
- Pied de page avec coordonnées et lien désinscription.

# Ton général
- Tutoiement uniquement si "preferredCommunicationStyle = casual" et que le client a moins de 35 ans.
- Sinon vouvoiement.
- Personnalisation OBLIGATOIRE avec le prénom.
- Référencer un détail factuel quand possible (dernier achat, ancienneté…) sans stalker.
- Pas de promesse exagérée. Pas d'urgence artificielle ("dernière chance !!").

# RGPD
- Pas d'informations médicales dans le message (pas de correction visuelle, pas de pathologie).
- Lien désinscription obligatoire en email.

# Format
JSON strict conforme au schéma.
`.trim();

export const MARKETING_RESPONSE_SCHEMA_EMAIL = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body', 'previewText', 'cta'],
  properties: {
    subject: { type: 'string', maxLength: 80 },
    body: { type: 'string', description: 'Corps en texte brut, sauts de ligne préservés' },
    previewText: { type: 'string', maxLength: 120 },
    cta: {
      type: 'object',
      additionalProperties: false,
      required: ['label', 'intent'],
      properties: {
        label: { type: 'string' },
        intent: { type: 'string', enum: ['book_appointment', 'visit_store', 'browse_collection', 'call_store'] },
      },
    },
  },
};

export const MARKETING_RESPONSE_SCHEMA_SMS = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'characterCount'],
  properties: {
    message: { type: 'string', maxLength: 160 },
    characterCount: { type: 'integer', maximum: 160 },
  },
};

export function buildMarketingUserMessage(ctx: MarketingContext): string {
  return `Génère un ${ctx.channel} pour le scénario "${ctx.scenario}".

Magasin : ${ctx.storeName} — ${ctx.storeAddress} — ${ctx.storePhone}

Client :
\`\`\`json
${JSON.stringify(ctx.client, null, 2)}
\`\`\`

${ctx.customNote ? `Note de l'opticien à intégrer : "${ctx.customNote}"` : ''}
${ctx.unsubscribeUrl ? `URL désinscription (email seulement) : ${ctx.unsubscribeUrl}` : ''}
Locale : ${ctx.locale}`;
}

/**
 * Prompt secondaire : segmentation des clients à recontacter.
 */
export const SEGMENTATION_PROMPT_VERSION = 'marketing-segmentation@1.0.0';

export const SEGMENTATION_SYSTEM_PROMPT = `
Tu es un analyste CRM. À partir d'une liste de clients avec leur historique, tu identifies ceux à recontacter en priorité.

# Critères
- Inactivité depuis 12-30 mois ET dépense passée significative.
- Date de prescription > 3 ans (renouvellement légal possible).
- Anniversaire dans les 14 jours.
- Achat récent sans suivi post-achat.

# Output
Pour chaque client retenu : un score de priorité 0-100, un scénario suggéré, une raison.
Tu ne sélectionnes que les clients où une relance a un VRAI sens. Pas de spam.
`.trim();
