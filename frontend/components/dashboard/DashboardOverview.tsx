'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  Users,
  AlertTriangle,
  Calendar,
  Package,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import { api } from '@/lib/api';

// ---------- Types ----------

interface DashboardData {
  kpis: {
    revenueToday: number;
    salesToday: number;
    revenueMonth: number;
    salesMonth: number;
    averageBasket: number;
    activeClients: number;
  };
  revenueByMonth: Array<{ month: string; revenue: number; count: number }>;
  topProducts: Array<{ id: string; name: string; qty: number; revenue: number }>;
  revenueByCategory: Array<{ category: string; revenue: number }>;
  lowStock: Array<{ id: string; name: string; quantity: number; reorderPoint: number }>;
  upcomingAppointments: Array<{ id: string; clientName: string; type: string; startsAt: string; status: string }>;
}

// ---------- Couleurs ----------

const CATEGORY_COLORS: Record<string, string> = {
  FRAME: '#6366f1',
  LENS: '#10b981',
  CONTACT_LENS: '#f59e0b',
  ACCESSORY: '#ec4899',
  SOLUTION: '#06b6d4',
  OTHER: '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  FRAME: 'Montures',
  LENS: 'Verres',
  CONTACT_LENS: 'Lentilles',
  ACCESSORY: 'Accessoires',
  SOLUTION: 'Solutions',
  OTHER: 'Autres',
};

// ---------- Composant principal ----------

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/api/v1/dashboard/overview')
      .then(setData)
      .catch((err) => setError(err?.message ?? 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
        {error ?? 'Impossible de charger le tableau de bord'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="CA aujourd'hui" value={`${formatEuros(data.kpis.revenueToday)} €`} accent="indigo" />
        <KpiCard icon={ShoppingBag} label="Ventes aujourd'hui" value={`${data.kpis.salesToday}`} accent="emerald" />
        <KpiCard icon={Wallet} label="Panier moyen" value={`${formatEuros(data.kpis.averageBasket)} €`} accent="amber" />
        <KpiCard icon={Users} label="Clients actifs (90j)" value={`${data.kpis.activeClients}`} accent="pink" />
      </div>

      {/* CA mois en cours — gros chiffre */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-indigo-700">CA du mois</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{formatEuros(data.kpis.revenueMonth)} €</span>
          <span className="text-sm text-slate-500">{data.kpis.salesMonth} ventes</span>
        </div>
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Évolution CA (2/3) */}
        <div className="lg:col-span-2">
          <Card title="Évolution du CA — 12 derniers mois">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueByMonth.map((r) => ({ ...r, label: formatMonth(r.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${formatEuros(value)} €`, 'CA']}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* CA par catégorie (1/3) */}
        <Card title="CA par catégorie ce mois">
          {data.revenueByCategory.length === 0 ? (
            <Empty text="Pas encore de ventes ce mois-ci." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.revenueByCategory.map((r) => ({
                      name: CATEGORY_LABELS[r.category] ?? r.category,
                      value: r.revenue,
                      color: CATEGORY_COLORS[r.category] ?? '#94a3b8',
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.revenueByCategory.map((r, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[r.category] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${formatEuros(value)} €`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Top produits + alertes stock */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top 5 produits ce mois">
          {data.topProducts.length === 0 ? (
            <Empty text="Pas de ventes ce mois-ci." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={140} />
                  <Tooltip
                    formatter={(value: any, name: any) => name === 'qty' ? [`${value} unités`, 'Quantité'] : [value, name]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="qty" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Alertes stock" icon={AlertTriangle} accent="amber">
          {data.lowStock.length === 0 ? (
            <Empty text="Aucune alerte stock — bravo ! 🎉" />
          ) : (
            <div className="space-y-2">
              {data.lowStock.map((s) => {
                const ratio = s.quantity / Math.max(s.reorderPoint, 1);
                const severity = ratio === 0 ? 'rouge' : ratio < 0.5 ? 'orange' : 'jaune';
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Package className="h-4 w-4 flex-shrink-0 text-amber-600" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Stock : {s.quantity} / seuil : {s.reorderPoint}
                        </div>
                      </div>
                    </div>
                    <span className={
                      severity === 'rouge'
                        ? 'rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700'
                        : severity === 'orange'
                        ? 'rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700'
                        : 'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700'
                    }>
                      {severity === 'rouge' ? 'Rupture' : severity === 'orange' ? 'Critique' : 'Bas'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* RDV à venir */}
      <Card title="Prochains rendez-vous (7 jours)" icon={Calendar}>
        {data.upcomingAppointments.length === 0 ? (
          <Empty text="Aucun RDV planifié dans la semaine." />
        ) : (
          <div className="space-y-2">
            {data.upcomingAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{a.clientName}</div>
                  <div className="text-[11px] text-slate-500">
                    {labelAppointmentType(a.type)} — {formatDateTime(a.startsAt)}
                  </div>
                </div>
                <span className={
                  a.status === 'CONFIRMED'
                    ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700'
                    : 'rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700'
                }>
                  {a.status === 'CONFIRMED' ? 'Confirmé' : 'Programmé'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Link
        href="/ventes"
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        Voir toutes les ventes <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ---------- Sous-composants ----------

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: 'indigo' | 'emerald' | 'amber' | 'pink' }) {
  const accentColors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    pink: 'bg-pink-50 text-pink-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accentColors[accent]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Card({ title, children, icon: Icon, accent }: { title: string; children: React.ReactNode; icon?: any; accent?: 'amber' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {Icon && <Icon className={`h-4 w-4 ${accent === 'amber' ? 'text-amber-600' : 'text-slate-500'}`} />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-slate-500">{text}</div>;
}

// ---------- Helpers ----------

function formatEuros(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function formatDateTime(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function labelAppointmentType(t: string): string {
  return ({ EXAM: 'Examen', FITTING: 'Ajustement', PICKUP: 'Retrait', CONSULTATION: 'Consultation', OTHER: 'Autre' } as Record<string, string>)[t] ?? t;
}
