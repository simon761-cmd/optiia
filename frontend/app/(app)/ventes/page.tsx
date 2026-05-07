'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  ShoppingBag,
  Wallet,
  Search,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';

// ----- Types -----

interface Sale {
  id: string;
  reference: string;
  status: string;
  totalTtc: string;
  paidAmount: string;
  createdAt: string;
  deliveredAt: string | null;
  client: { id: string; firstName: string; lastName: string };
  itemsCount: number;
}

interface SalesResponse {
  data: Sale[];
  nextCursor: string | null;
}

interface Stats {
  revenueMonth: number;
  salesMonth: number;
  averageBasket: number;
  pendingCount: number;
  readyCount: number;
}

type StatusFilter = 'all' | 'DELIVERED' | 'READY' | 'PENDING' | 'QUOTE' | 'CANCELLED';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'DELIVERED', label: 'Livrées' },
  { value: 'READY', label: 'Prêtes' },
  { value: 'PENDING', label: 'En cours' },
  { value: 'QUOTE', label: 'Devis' },
  { value: 'CANCELLED', label: 'Annulées' },
];

// ----- Page -----

export default function SalesPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger stats (1 fois au montage)
  useEffect(() => {
    api
      .get<Stats>('/api/v1/sales/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Charger ventes (à chaque changement de filtre)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('limit', '100');
    if (statusFilter !== 'all') params.set('status', statusFilter);

    api
      .get<SalesResponse>(`/api/v1/sales?${params}`)
      .then((res) => {
        if (!cancelled) setSales(res.data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Impossible de charger les ventes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  // Filtrage local par recherche (référence client ou n° vente)
  const filteredSales = search.trim()
    ? sales.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.reference.toLowerCase().includes(q) ||
          `${s.client.firstName} ${s.client.lastName}`.toLowerCase().includes(q)
        );
      })
    : sales;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Ventes</h1>
        <p className="text-sm text-slate-500">Suivi de tes ventes et de leur statut</p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={TrendingUp}
          label="CA du mois"
          value={stats ? `${formatEuros(stats.revenueMonth)} €` : '…'}
          accent="indigo"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Ventes du mois"
          value={stats ? `${stats.salesMonth}` : '…'}
          subtext={stats ? `${stats.pendingCount} en cours, ${stats.readyCount} prêtes` : undefined}
          accent="emerald"
        />
        <KpiCard
          icon={Wallet}
          label="Panier moyen"
          value={stats ? `${formatEuros(stats.averageBasket)} €` : '…'}
          accent="amber"
        />
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence ou client…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={clsx(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                statusFilter === opt.value
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {search ? `Aucune vente pour "${search}"` : 'Aucune vente sur cette période'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="cursor-pointer transition hover:bg-indigo-50/40"
                  onClick={() => router.push(`/clients/${sale.client.id}`)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{sale.reference}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {sale.client.firstName} {sale.client.lastName}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(sale.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {sale.itemsCount} art.
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sale.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                    {formatEuros(Number(sale.totalTtc))} €
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      {!loading && filteredSales.length > 0 && (
        <div className="mt-3 text-xs text-slate-500">
          {filteredSales.length} vente{filteredSales.length > 1 ? 's' : ''}
          {search && ` correspondant à "${search}"`}
        </div>
      )}
    </div>
  );
}

// ----- Composants utilitaires -----

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  subtext?: string;
  accent: 'indigo' | 'emerald' | 'amber';
}) {
  const accentColors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentColors[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {subtext && <div className="mt-1 text-xs text-slate-500">{subtext}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    DELIVERED: { label: 'Livré', color: 'bg-emerald-50 text-emerald-700' },
    READY: { label: 'Prêt', color: 'bg-blue-50 text-blue-700' },
    PENDING: { label: 'En cours', color: 'bg-amber-50 text-amber-700' },
    QUOTE: { label: 'Devis', color: 'bg-slate-100 text-slate-600' },
    CANCELLED: { label: 'Annulé', color: 'bg-rose-50 text-rose-700' },
  };
  const info = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${info.color}`}>{info.label}</span>;
}

// ----- Helpers -----

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEuros(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}