/**
 * Prompts pour la prédiction de stock et la génération de bons de commande.
 */

export const STOCK_PROMPT_VERSION = 'stock-prediction@1.0.0';

export interface StockItemHistory {
  productId: string;
  productName: string;
  category: string;
  supplier: string | null;
  currentStock: number;
  reorderPoint: number;
  leadTimeDays: number; // délai fournisseur
  unitCost: number;
  // ventes des 12 dernières semaines
  weeklySales: { weekStart: string; units: number }[];
  // saisonnalité connue
  seasonalIndex?: { month: number; multiplier: number }[];
}

export const STOCK_SYSTEM_PROMPT = `
Tu es un expert en gestion de stock pour boutiques d'optique. Tu prédits les ventes futures et recommandes les réapprovisionnements.

# Méthode
1. Analyse les 12 dernières semaines de ventes pour estimer le rythme moyen et la tendance.
2. Applique la saisonnalité fournie (ou typique du secteur si absente).
3. Calcule la couverture actuelle = currentStock / vente_hebdo_estimée.
4. Compare au délai fournisseur (leadTimeDays) + un buffer de sécurité (50% pour produits réguliers, 100% pour produits critiques peu réguliers).
5. Détermine si une commande est nécessaire dans les 7 prochains jours.

# Règles
- Tu ne recommandes JAMAIS de sur-stocker (la trésorerie compte).
- Tu signales les produits "morts" : aucune vente sur 8+ semaines → suggestion de déstockage / non-réapprovisionnement.
- Pour les produits hautement saisonniers (lunettes solaires en hiver), tu lisses sur 12 mois.
- Tu indiques un niveau de confiance par item (les nouveaux produits avec peu d'historique = confiance basse).

# Cadre opticien
- Une monture moyenne se vend 0,5-3 unités/mois selon le magasin.
- Les verres sont produits sur commande (pas concernés par cette prédiction).
- Les solaires : pic mai-août, creux nov-fév.

# Format
JSON strict conforme au schéma.
`.trim();

export const STOCK_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['predictions', 'reorderSuggestions', 'deadStockAlerts'],
  properties: {
    predictions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['productId', 'predictedUnits4Weeks', 'predictedUnits12Weeks', 'trend', 'confidence'],
        properties: {
          productId: { type: 'string' },
          predictedUnits4Weeks: { type: 'integer', minimum: 0 },
          predictedUnits12Weeks: { type: 'integer', minimum: 0 },
          trend: { type: 'string', enum: ['rising', 'stable', 'declining'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    reorderSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['productId', 'urgency', 'suggestedQuantity', 'reasoning'],
        properties: {
          productId: { type: 'string' },
          urgency: { type: 'string', enum: ['immediate', 'within_7d', 'within_30d'] },
          suggestedQuantity: { type: 'integer', minimum: 1 },
          reasoning: { type: 'string' },
        },
      },
    },
    deadStockAlerts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['productId', 'weeksWithoutSale', 'recommendedAction'],
        properties: {
          productId: { type: 'string' },
          weeksWithoutSale: { type: 'integer' },
          recommendedAction: { type: 'string' },
        },
      },
    },
  },
};

export function buildStockUserMessage(items: StockItemHistory[], asOfDate: string): string {
  return `Date d'analyse : ${asOfDate}
${items.length} produits à analyser :

\`\`\`json
${JSON.stringify(items, null, 2)}
\`\`\``;
}
