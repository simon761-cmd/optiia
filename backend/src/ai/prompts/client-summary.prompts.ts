/**
 * Prompt pour le résumé client (fiche IA condensée).
 */

export const CLIENT_SUMMARY_PROMPT_VERSION = 'client-summary@1.0.0';

export interface ClientSummaryInput {
  client: {
    id: string;
    fullName: string;
    age: number | null;
    gender: string | null;
    createdAt: string;
    locale: string;
  };
  prescriptions: Array<{
    prescribedAt: string;
    type: string;
    od: { sphere: number | null; cylinder: number | null; axis: number | null; addition: number | null } | null;
    og: { sphere: number | null; cylinder: number | null; axis: number | null; addition: number | null } | null;
  }>;
  purchases: Array<{
    date: string;
    items: { name: string; category: string; brand: string | null; price: number }[];
    total: number;
  }>;
  appointments: Array<{ date: string; type: string; status: string }>;
  notes: string[]; // notes manuelles laissées par les opticiens
}

export const CLIENT_SUMMARY_SYSTEM_PROMPT = `
Tu génères une fiche de synthèse client pour un opticien, lisible en moins de 30 secondes.

# Structure attendue
1. **Profil** : 1 phrase (âge, ancienneté, segment).
2. **Vision** : évolution de la correction sur les dernières ordonnances (stable, en évolution, presbytie installée…).
3. **Habitudes d'achat** : fréquence, panier moyen, marques préférées, type de produits.
4. **Préférences** : style de monture, matériaux, options verres récurrentes (déduit des achats).
5. **Recommandations actionnables** : 1 à 3 actions concrètes pour la prochaine visite.
6. **Tags** : 3 à 6 mots-clés (ex: "fidèle", "presbyte", "haut de gamme", "fan Ray-Ban").

# Règles
- Concis. Aucune phrase superflue.
- Tu n'inventes JAMAIS. Si un champ est inconnu, tu écris "Donnée insuffisante".
- Données médicales : tu peux les mentionner ici (interface interne opticien) MAIS jamais dans un message marketing.
- Tutoiement professionnel.

# Format
JSON strict.
`.trim();

export const CLIENT_SUMMARY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['profile', 'vision', 'purchaseHabits', 'preferences', 'recommendations', 'tags', 'segment'],
  properties: {
    profile: { type: 'string' },
    vision: { type: 'string' },
    purchaseHabits: { type: 'string' },
    preferences: { type: 'string' },
    recommendations: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'rationale'],
        properties: {
          action: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
    tags: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: { type: 'string' },
    },
    segment: {
      type: 'string',
      enum: ['VIP', 'fidele', 'occasionnel', 'nouveau', 'a_relancer', 'inactif'],
    },
  },
};

export function buildClientSummaryUserMessage(input: ClientSummaryInput): string {
  return `Voici les données complètes du client. Génère la synthèse au format demandé.

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\``;
}
