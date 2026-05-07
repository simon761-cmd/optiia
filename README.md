# OptiIA — SaaS pour opticiens propulsé par l'IA

Plateforme SaaS multi-tenant pour la gestion complète d'un magasin d'optique, avec IA intégrée comme élément central (assistant conversationnel, recommandations commerciales, OCR ordonnances, prédiction de stock, marketing automatisé).

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router) + TailwindCSS + shadcn/ui |
| Backend | NestJS 10 (modulaire, Prisma ORM) |
| BDD | PostgreSQL 15 (multi-tenant via `tenantId`) |
| IA | OpenAI API (GPT-4o, Whisper, Vision) — abstrait via `LlmService` pour multi-provider |
| Paiements | Stripe (abonnements + webhooks) |
| File queue | BullMQ + Redis (jobs IA asynchrones) |
| Cache | Redis |
| Storage | AWS S3 (ordonnances, documents) |
| Hébergement | Backend → AWS ECS Fargate, Frontend → Vercel |

## Structure du repo

```
optiia/
├── docs/
│   ├── 01-architecture.md       # Architecture globale
│   ├── 02-ai-module.md          # Module IA détaillé
│   └── 03-api-routes.md         # Routes API
├── prisma/
│   └── schema.prisma            # Schéma BDD complet
├── backend/                     # NestJS
│   └── src/
│       ├── auth/                # JWT + RBAC
│       ├── ai/                  # ⭐ Module IA central
│       ├── clients/
│       ├── prescriptions/
│       ├── sales/
│       ├── stock/
│       └── tenants/
└── frontend/                    # Next.js
    └── components/ai/           # Chat IA inline
```

## Lancement rapide

```bash
# Backend
cd backend && pnpm install
cp .env.example .env
pnpm prisma migrate dev
pnpm start:dev

# Frontend
cd frontend && pnpm install && pnpm dev
```

## Plans SaaS et quotas IA

| Plan | Prix/mois | Quota IA | Fonctionnalités IA |
|---|---|---|---|
| Starter | 49 € | 100 calls | Chat, OCR, résumé client |
| Pro | 99 € | 1 000 calls | + recommandations, analyse ventes, marketing |
| Premium | 199 € | Illimité* | + prédiction stock, voice assistant |

*Soft cap raisonnable + facturation usage au-delà.

---

Voir `docs/01-architecture.md` pour démarrer.
