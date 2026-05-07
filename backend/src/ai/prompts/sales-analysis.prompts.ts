/**
 * Prompts pour l'analyse de ventes (résumé + anomalies + conseils).
 */

export const SALES_PROMPT_VERSION = 'sales-analysis@1.0.0';

export interface SalesAnalysisInput {
  period: { from: string; to: string; label: string }; // ex: "Octobre 2026"
  current: SalesPeriodMetrics;
  previous: SalesPeriodMetrics; // période N-1 (mois précédent)
  yearAgo: SalesPeriodMetrics | null; // N-1 année
  topProducts: { name: string; revenue: number; units: number }[];
  bottomProducts: { name: string; revenue: number; units: number }[];
  topClients: { name: string; revenue: number; visits: number }[];
  dailyRevenue: { date: string; revenue: number }[];
  anomalies: { date: string; type: string; description: string }[];
}

export interface SalesPeriodMetrics {
  revenue: number;
  margin: number;
  marginRate: number; // %
  ticketsCount: number;
  avgBasket: number;
  uniqueClients: number;
  newClients: number;
  conversionRate: number | null;
}

export const SALES_SYSTEM_PROMPT = `
Tu es un analyste business spécialisé dans le retail optique français. Tu rédiges des notes de synthèse pour le gérant d'une boutique d'optique.

# Mission
Analyser les performances d'une période (mois ou semaine) et produire :
1. Un résumé exécutif factuel (3-5 lignes max)
2. Les 3 points clés positifs
3. Les 2-3 points d'attention
4. Des recommandations actionnables (3 max)
5. Un score de santé business sur 100

# Style
- Direct, factuel, chiffré. Pas de jargon corporate.
- Tu parles au gérant comme à un confrère : tutoiement professionnel.
- Tu cites toujours des chiffres précis (€, %, évolution vs période précédente).
- Tu n'inventes JAMAIS de données. Si une comparaison est impossible (pas d'historique), tu le dis.

# Détection d'anomalies
- Une anomalie pré-détectée (ex: chute > 30% un jour particulier) doit être commentée.
- Si tu repères toi-même un signal faible dans les données fournies (ex: catégorie en chute, client TOP qui s'éloigne), tu le mentionnes.

# Cadre opticien
- Saisonnalité : pic de rentrée (sept), baisse été, pic fin d'année.
- Le panier moyen optique en France se situe ~350-450€. Adapte tes commentaires en conséquence.
- La marge typique est 60-65% en optique de monture, 70%+ en verres haut de gamme.

# Format
JSON strict conforme au schéma.
`.trim();

export const SALES_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['executiveSummary', 'highlights', 'attentionPoints', 'recommendations', 'healthScore'],
  properties: {
    executiveSummary: { type: 'string' },
    highlights: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
    attentionPoints: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'severity'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    recommendations: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'expectedImpact', 'effort'],
        properties: {
          action: { type: 'string' },
          expectedImpact: { type: 'string' },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    healthScore: { type: 'integer', minimum: 0, maximum: 100 },
  },
};

export function buildSalesUserMessage(input: SalesAnalysisInput): string {
  return `Voici les données de performance pour la période "${input.period.label}" (${input.period.from} → ${input.period.to}).
Analyse-les et produis le rapport au format demandé.

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\``;
}
