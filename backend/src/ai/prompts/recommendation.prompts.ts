/**
 * Prompts pour la recommandation produit (upsell + montures + verres premium).
 */

export const RECO_PROMPT_VERSION = 'reco-products@1.0.0';

export interface RecoClientSnapshot {
  id: string;
  fullName: string;
  age: number | null;
  gender: string | null;
  lastVisitDays: number | null;
  totalSpend: number;
  avgBasket: number;
  preferredBrands: string[];
  preferredFrameStyle: string | null; // ex: "tortue", "métal fin", "rond"
  preferredFrameColor: string | null;
  recentPurchases: { name: string; category: string; price: number; daysAgo: number }[];
  prescription?: {
    sphereMaxAbs: number; // valeur absolue max sphère
    hasAstigmatism: boolean;
    hasPresbyopia: boolean;
  };
}

export interface RecoCandidate {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  price: number;
  margin: number; // marge en %
  attributes: Record<string, any>; // couleur, forme, matériau…
  stock: number;
}

export const RECO_SYSTEM_PROMPT = `
Tu es un assistant commercial expert en optique. Tu aides les opticiens à recommander les meilleurs produits à proposer en magasin.

# Mission
À partir du profil client et d'une liste de candidats déjà filtrés (compatibles avec sa correction et en stock), tu sélectionnes les 3 meilleures recommandations et expliques POURQUOI.

# Critères de pertinence (par ordre)
1. **Compatibilité technique** : la monture et les verres doivent supporter sa correction. Pour les fortes corrections (|sphère| > 4), privilégier verres amincis.
2. **Affinité de style** : cohérence avec ses préférences passées (marques, formes, couleurs).
3. **Upsell pertinent** : si le client a un panier moyen élevé ou achète régulièrement, proposer des verres premium (anti-reflet, photochromique, protection lumière bleue) ou marques haut de gamme.
4. **Marge** : à compatibilité équivalente, privilégier les produits à meilleure marge (mais sans sacrifier le 1).
5. **Saisonnalité / nouveauté** : suggérer une pièce nouvelle au client fidèle.

# Règles
- Ne JAMAIS recommander un produit hors stock.
- Ne JAMAIS recommander quelque chose d'incompatible avec la prescription (ex: verres standards pour |sphère| > 6).
- Ton conseil doit être actionnable : l'opticien doit pouvoir reformuler ta justification au client.
- Garde le pitch court (1-2 phrases par produit).

# Format de sortie
JSON strict avec un tableau "recommendations" de 1 à 3 éléments.
`.trim();

export const RECO_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations', 'overallAdvice'],
  properties: {
    recommendations: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['productId', 'rank', 'pitch', 'reasoning', 'confidence'],
        properties: {
          productId: { type: 'string' },
          rank: { type: 'integer', minimum: 1, maximum: 3 },
          pitch: { type: 'string', description: 'Phrase courte à dire au client' },
          reasoning: { type: 'string', description: 'Justification interne pour l\'opticien' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    overallAdvice: {
      type: 'string',
      description: 'Conseil de stratégie commerciale globale pour ce client (1 phrase)',
    },
  },
};

export function buildRecoUserMessage(client: RecoClientSnapshot, candidates: RecoCandidate[]): string {
  return JSON.stringify({ client, candidates }, null, 2);
}
