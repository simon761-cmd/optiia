'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Camera,
  MessageSquare,
  BarChart3,
  Users,
  Brain,
  Zap,
  Check,
  ArrowRight,
  Mail,
  ChevronDown,
  Star,
  Clock,
  TrendingUp,
  Shield,
} from 'lucide-react';
import clsx from 'clsx';

import { useAuthStore } from '@/lib/auth-store';

export default function LandingPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  return (
    <div className="bg-white">
      <Navigation isLoggedIn={isHydrated && !!accessToken} />
      <Hero />
      <Benefits />
      <Features />
      <DemoSection />
      <Testimonials />
      <Pricing />
      <Faq />
      <Contact />
      <Footer />
    </div>
  );
}

// ===========================================
// NAVIGATION
// ===========================================

function Navigation({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200/50 py-3'
          : 'bg-transparent py-5',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-600/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight text-slate-900">OptiIA</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">Fonctionnalités</a>
          <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">Tarifs</a>
          <a href="#faq" className="text-sm text-slate-600 hover:text-slate-900">FAQ</a>
          <a href="#contact" className="text-sm text-slate-600 hover:text-slate-900">Contact</a>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                Connexion
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Essai gratuit
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ===========================================
// HERO
// ===========================================

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pb-32 pt-32 md:pt-40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/30 blur-3xl" />
        <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-blue-200/30 to-indigo-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/50 bg-white/50 px-3 py-1.5 text-xs font-medium text-indigo-700 backdrop-blur">
            <Sparkles className="h-3 w-3" />
            <span>Propulsé par GPT-4o · Spécialement conçu pour les opticiens</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Le logiciel opticien
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              augmenté par l'intelligence artificielle
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Automatisez la lecture des ordonnances, générez des messages clients personnalisés,
            anticipez vos ruptures de stock. Concentrez-vous sur ce qui compte vraiment :
            vos clients.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 hover:shadow-xl"
            >
              Démarrer mon essai gratuit
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Voir les fonctionnalités
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              14 jours d'essai gratuit
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Sans carte bancaire
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Données hébergées en Europe
            </span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <div className="h-3 w-3 rounded-full bg-rose-400/60" />
              <div className="h-3 w-3 rounded-full bg-amber-400/60" />
              <div className="h-3 w-3 rounded-full bg-emerald-400/60" />
              <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-slate-400">
                optiia.fr/dashboard
              </div>
            </div>
            <div className="grid grid-cols-12 divide-x divide-slate-100">
              <div className="col-span-2 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold">OptiIA</span>
                </div>
                <div className="space-y-1">
                  <div className="rounded bg-indigo-50 px-2 py-1.5 text-[11px] font-medium text-indigo-700">
                    Tableau de bord
                  </div>
                  <div className="px-2 py-1.5 text-[11px] text-slate-600">Clients</div>
                  <div className="px-2 py-1.5 text-[11px] text-slate-600">Ventes</div>
                  <div className="px-2 py-1.5 text-[11px] text-slate-600">Agenda</div>
                </div>
              </div>
              <div className="col-span-7 p-5">
                <h3 className="text-sm font-semibold text-slate-900">Bonjour Simon 👋</h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { l: 'CA jour', v: '1 250 €' },
                    { l: 'Ventes', v: '4' },
                    { l: 'Clients', v: '87' },
                  ].map((k, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-white p-2.5">
                      <div className="text-[9px] uppercase text-slate-500">{k.l}</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">{k.v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white p-3">
                  <div className="text-[10px] font-medium uppercase text-indigo-700">CA du mois</div>
                  <div className="mt-0.5 text-xl font-bold text-slate-900">28 540 €</div>
                  <div className="mt-2 h-16 rounded bg-gradient-to-r from-indigo-100 to-purple-100" />
                </div>
              </div>
              <div className="col-span-3 bg-slate-50/50 p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-indigo-600" />
                  <span className="text-[10px] font-semibold">Assistant IA</span>
                </div>
                <div className="space-y-2">
                  <div className="ml-4 rounded-lg bg-slate-900 p-2 text-[10px] text-white">
                    Top 5 produits du mois ?
                  </div>
                  <div className="rounded-lg bg-white p-2 text-[10px] text-slate-700 shadow-sm">
                    <div className="mb-1 inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[8px] text-indigo-700">
                      ⚙️ get_top_products
                    </div>
                    <div>1. Ray-Ban Wayfarer (12)</div>
                    <div>2. Persol 649 (9)</div>
                    <div>3. Oakley Holbrook (7)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===========================================
// BENEFITS
// ===========================================

function Benefits() {
  const stats = [
    { icon: Clock, value: '5h', label: 'gagnées par semaine' },
    { icon: TrendingUp, value: '+12%', label: 'sur le panier moyen' },
    { icon: Brain, value: '95%', label: "d'OCR ordonnance" },
    { icon: Zap, value: '<2s', label: 'pour générer un message' },
  ];

  return (
    <section className="border-y border-slate-100 bg-slate-50/40 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <s.icon className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-900">{s.value}</div>
              <div className="mt-1 text-sm text-slate-600">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================
// FEATURES
// ===========================================

function Features() {
  const features = [
    {
      icon: Camera,
      title: 'OCR ordonnances',
      description: "Photographiez une ordonnance manuscrite. L'IA lit les valeurs (sphère, cylindre, axe, addition) et remplit la fiche automatiquement.",
      color: 'indigo',
    },
    {
      icon: Brain,
      title: 'Assistant IA boutique',
      description: 'Posez vos questions en langage naturel. "Qui sont mes clients à relancer ?" "Quel est mon CA du mois ?". L\'IA interroge vos données.',
      color: 'purple',
    },
    {
      icon: MessageSquare,
      title: 'Messages personnalisés',
      description: 'Email ou SMS générés en 5 secondes : relances, anniversaires, ordonnances expirées. Validation RGPD automatique.',
      color: 'pink',
    },
    {
      icon: BarChart3,
      title: 'Tableau de bord intelligent',
      description: 'KPIs en temps réel, top produits, alertes stock, prédictions. Tout ce qu\'il vous faut pour piloter votre boutique.',
      color: 'emerald',
    },
    {
      icon: Users,
      title: 'Fiche client enrichie',
      description: 'Synthèse IA du profil de chaque client : habitudes d\'achat, préférences, recommandations actionnables. Mis à jour automatiquement.',
      color: 'blue',
    },
    {
      icon: Shield,
      title: '100% conforme RGPD',
      description: 'Hébergement européen, consentements traçables, droit à l\'oubli intégré. Concentrez-vous sur vos clients, pas sur la conformité.',
      color: 'amber',
    },
  ];

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Fonctionnalités
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tout ce dont vous avez besoin pour gérer votre boutique
          </p>
          <p className="mt-4 text-lg text-slate-600">
            Six modules pensés par et pour les opticiens, propulsés par l'IA dernière génération.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
            >
              <div className={clsx('mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl', colorMap[f.color])}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================
// DEMO SECTION
// ===========================================

function DemoSection() {
  return (
    <section className="bg-slate-900 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">
              Démo en direct
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              "Quels clients je peux relancer cette semaine ?"
            </p>
            <p className="mt-4 text-lg text-slate-300">
              Avec OptiIA, posez votre question en langage naturel.
              L'assistant interroge vos données, identifie les bons clients
              et propose des actions concrètes.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                'Compréhension du français parlé',
                'Données croisées : ventes, ordonnances, RDV',
                'Recommandations actionnables, pas de blabla',
                'Confidentialité totale : vos données ne quittent jamais votre boutique',
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                  <span className="text-sm text-slate-200">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">Assistant OptiIA</span>
            </div>

            <div className="space-y-3">
              <div className="ml-12 rounded-2xl rounded-tr-sm bg-slate-700 px-4 py-2.5 text-sm text-white">
                Quels clients je peux relancer cette semaine ?
              </div>

              <div className="rounded-2xl rounded-tl-sm bg-slate-900 p-4 text-sm">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  ⚡ find_inactive_clients
                </div>
                <div className="space-y-2 text-slate-300">
                  <p>J'ai trouvé <span className="font-semibold text-white">12 clients prioritaires</span> :</p>
                  <ul className="space-y-1.5 text-xs">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 rounded-full bg-indigo-400"></span>
                      <span><strong className="text-white">Marie Dupont</strong> — pas vue depuis 18 mois, ordo expirée</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 rounded-full bg-indigo-400"></span>
                      <span><strong className="text-white">Pierre Martin</strong> — anniversaire dans 5 jours, fidèle</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 rounded-full bg-indigo-400"></span>
                      <span><strong className="text-white">Sophie Bernard</strong> — VIP, dernier achat &gt; 12 mois</span>
                    </li>
                  </ul>
                  <p className="pt-1 text-xs">Je peux générer les emails de relance en 1 clic ?</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===========================================
// TESTIMONIALS
// ===========================================

function Testimonials() {
  const testimonials = [
    {
      quote: "OptiIA m'a fait gagner au moins 4 heures par semaine sur les relances clients. Le ROI est immédiat.",
      author: 'Marie L.',
      role: 'Opticienne, Nantes',
    },
    {
      quote: "L'OCR des ordonnances change tout. Plus de saisie manuelle, zéro erreur. Je le recommande à tous mes confrères.",
      author: 'Thomas D.',
      role: 'Gérant 2 boutiques, Bordeaux',
    },
    {
      quote: "Le chat IA m'aide à prendre des décisions chaque jour. Pour piloter mon stock, c'est devenu indispensable.",
      author: 'Aurélie P.',
      role: 'Opticienne indépendante, Lyon',
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Ils nous font confiance
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Ce que disent les opticiens
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-6"
            >
              <div className="mb-4 flex gap-0.5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-slate-700">"{t.quote}"</p>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="text-sm font-medium text-slate-900">{t.author}</div>
                <div className="text-xs text-slate-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================
// PRICING
// ===========================================

function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: 49,
      description: "L'essentiel pour démarrer",
      features: [
        '1 boutique',
        "Jusqu'à 3 utilisateurs",
        '100 requêtes IA / mois',
        'OCR ordonnances illimité',
        'Support par email',
      ],
      cta: 'Commencer',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: 99,
      description: 'Le choix des opticiens établis',
      features: [
        '2 boutiques',
        "Jusqu'à 10 utilisateurs",
        '1 000 requêtes IA / mois',
        'OCR + génération marketing',
        'Synthèse IA clients',
        'Support prioritaire',
      ],
      cta: 'Essai gratuit',
      highlighted: true,
    },
    {
      name: 'Premium',
      price: 199,
      description: 'Pour les chaînes et multi-boutiques',
      features: [
        'Boutiques illimitées',
        'Utilisateurs illimités',
        'IA illimitée',
        'Multi-tenant avancé',
        'API personnalisée',
        'Support dédié 24/7',
        'Onboarding sur-mesure',
      ],
      cta: 'Nous contacter',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="bg-slate-50/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Tarifs
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Un plan adapté à chaque boutique
          </p>
          <p className="mt-4 text-lg text-slate-600">
            14 jours d'essai gratuit. Sans carte bancaire. Sans engagement.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={clsx(
                'relative rounded-2xl border p-8 transition',
                plan.highlighted
                  ? 'border-slate-900 bg-slate-900 text-white shadow-xl scale-105'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg">
                  Recommandé
                </div>
              )}

              <h3 className={clsx('text-lg font-semibold', plan.highlighted ? 'text-white' : 'text-slate-900')}>
                {plan.name}
              </h3>
              <p className={clsx('mt-1 text-sm', plan.highlighted ? 'text-slate-400' : 'text-slate-500')}>
                {plan.description}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className={clsx('text-4xl font-bold tracking-tight', plan.highlighted ? 'text-white' : 'text-slate-900')}>
                  {plan.price}€
                </span>
                <span className={clsx('text-sm', plan.highlighted ? 'text-slate-400' : 'text-slate-500')}>
                  / mois HT
                </span>
              </div>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feat, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm">
                    <Check className={clsx('mt-0.5 h-4 w-4 flex-shrink-0', plan.highlighted ? 'text-emerald-400' : 'text-emerald-600')} />
                    <span className={plan.highlighted ? 'text-slate-200' : 'text-slate-700'}>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={clsx(
                  'mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition',
                  plan.highlighted
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===========================================
// FAQ
// ===========================================

function Faq() {
  const faqs = [
    {
      q: "Comment se passe l'essai gratuit ?",
      a: "Vous créez votre compte en 30 secondes, sans carte bancaire. Vous avez accès à toutes les fonctionnalités du plan Pro pendant 14 jours. À la fin, vous choisissez le plan qui vous convient ou vous arrêtez sans frais.",
    },
    {
      q: 'Mes données sont-elles en sécurité ?',
      a: "Absolument. OptiIA est hébergé sur des serveurs européens (RGPD). Vos données sont chiffrées au repos et en transit. Chaque boutique est strictement isolée des autres (architecture multi-tenant).",
    },
    {
      q: "L'IA peut-elle se tromper ?",
      a: "L'OCR a un taux de précision de 95% sur des ordonnances bien lisibles. Pour chaque ordonnance scannée, vous validez les valeurs avant enregistrement. Pour le chat, l'IA peut faire des erreurs d'interprétation, c'est pourquoi elle ne réalise jamais d'action sans votre confirmation.",
    },
    {
      q: 'Puis-je importer mes données existantes ?',
      a: "Oui, sur le plan Pro et Premium nous proposons un import depuis vos fichiers CSV/Excel. Pour les chaînes, nous accompagnons la migration depuis votre ancien logiciel.",
    },
    {
      q: "Que se passe-t-il si j'arrête mon abonnement ?",
      a: "Vous gardez accès à votre compte 30 jours en lecture seule pour récupérer vos données. Vous pouvez les exporter à tout moment au format Excel ou JSON. Aucune donnée n'est supprimée sans préavis.",
    },
  ];

  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">FAQ</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Questions fréquentes
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <FaqItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="text-sm font-medium text-slate-900">{question}</span>
        <ChevronDown
          className={clsx(
            'h-5 w-5 flex-shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 text-sm leading-relaxed text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}

// ===========================================
// CONTACT
// ===========================================

function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <section id="contact" className="bg-slate-50/50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Contact</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Une question ? Parlons-en
          </p>
          <p className="mt-4 text-lg text-slate-600">
            Notre équipe vous répond sous 24h ouvrées.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-12 space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="Présentez-vous et dites-nous comment nous pouvons aider"
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {sent && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✓ Message envoyé ! Nous vous recontacterons sous 24h ouvrées.
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Envoyer le message
          </button>

          <p className="text-center text-xs text-slate-500">
            Vous préférez l'email ?{' '}
            <a href="mailto:contact@optiia.fr" className="font-medium text-indigo-600 hover:underline">
              contact@optiia.fr
            </a>
          </p>
        </form>
      </div>
    </section>
  );
}

// ===========================================
// FOOTER
// ===========================================

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-slate-900">OptiIA</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-slate-600">
              Le logiciel opticien augmenté par l'IA. Conçu en France pour les opticiens indépendants.
            </p>
            <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              <a href="mailto:contact@optiia.fr" className="hover:text-slate-900">contact@optiia.fr</a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-900">Produit</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><a href="#features" className="hover:text-slate-900">Fonctionnalités</a></li>
              <li><a href="#pricing" className="hover:text-slate-900">Tarifs</a></li>
              <li><a href="#faq" className="hover:text-slate-900">FAQ</a></li>
              <li><Link href="/signup" className="hover:text-slate-900">Essai gratuit</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-900">Entreprise</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><a href="#contact" className="hover:text-slate-900">Contact</a></li>
              <li><a href="#" className="hover:text-slate-900">Mentions légales</a></li>
              <li><a href="#" className="hover:text-slate-900">Politique de confidentialité</a></li>
              <li><a href="#" className="hover:text-slate-900">CGU</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} OptiIA. Tous droits réservés. Hébergé en Europe 🇪🇺
        </div>
      </div>
    </footer>
  );
}
