'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Cake,
  Loader2,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  FileText,
  Calendar,
  Eye,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';
import { PrescriptionModal } from '@/components/prescriptions/PrescriptionModal';
import { MarketingMessageModal } from '@/components/marketing/MarketingMessageModal';

// ----- Types -----

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  notes: string | null;
  tags: string[];
  preferredBrands: string[];
  averageBudget: string | null;
  createdAt: string;
  prescriptions: Prescription[];
  sales: Sale[];
  appointments: Appointment[];
  kpis: {
    totalSpend: number;
    salesCount: number;
    lastVisitAt: string | null;
  };
}

interface Prescription {
  id: string;
  type: string;
  status: string;
  doctorName: string | null;
  issuedAt: string | null;
  odSphere: string | null;
  odCylinder: string | null;
  odAxis: number | null;
  odAddition: string | null;
  ogSphere: string | null;
  ogCylinder: string | null;
  ogAxis: number | null;
  ogAddition: string | null;
}

interface SaleItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceHt: string;
  totalTtc: string;
  product: { name: string; brand: string | null; category: string } | null;
}

interface Sale {
  id: string;
  reference: string;
  status: string;
  totalTtc: string;
  createdAt: string;
  items: SaleItem[];
}

interface Appointment {
  id: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
}

type Tab = 'overview' | 'sales' | 'prescriptions' | 'appointments' | 'ai';

// ----- Page -----

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [marketingModalOpen, setMarketingModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<ClientDetail>(`/api/v1/clients/${id}`)
      .then((data) => {
        if (!cancelled) setClient(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError('Impossible de charger le client');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mr-1.5 inline h-4 w-4" />
          {error ?? 'Client introuvable'}
        </div>
      </div>
    );
  }

  const age = client.birthDate ? computeAge(client.birthDate) : null;
  const fullAddress = [client.addressLine1, client.postalCode, client.city].filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Retour */}
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Retour à la liste
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar firstName={client.firstName} lastName={client.lastName} large />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {client.firstName} {client.lastName}
              </h1>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                {client.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </span>
                )}
                {fullAddress && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {fullAddress}
                  </span>
                )}
                {age !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Cake className="h-3.5 w-3.5" /> {age} ans
                  </span>
                )}
              </div>

              {client.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {client.tags.map((t) => (
                    <span key={t} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <button
            type="button"
            onClick={() => setMarketingModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <MessageSquare className="h-4 w-4" />
            Générer un message
          </button>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard icon={TrendingUp} label="Total dépensé" value={`${formatEuros(client.kpis.totalSpend)} €`} />
          <KpiCard icon={ShoppingBag} label="Achats" value={`${client.kpis.salesCount}`} />
          <KpiCard
            icon={Calendar}
            label="Dernière visite"
            value={client.kpis.lastVisitAt ? formatDate(client.kpis.lastVisitAt) : '—'}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          <TabButton current={activeTab} value="overview" onSelect={setActiveTab} icon={Eye}>Vue d'ensemble</TabButton>
          <TabButton current={activeTab} value="sales" onSelect={setActiveTab} icon={ShoppingBag} count={client.sales.length}>
            Achats
          </TabButton>
          <TabButton current={activeTab} value="prescriptions" onSelect={setActiveTab} icon={FileText} count={client.prescriptions.length}>
            Ordonnances
          </TabButton>
          <TabButton current={activeTab} value="appointments" onSelect={setActiveTab} icon={Calendar} count={client.appointments.length}>
            Rendez-vous
          </TabButton>
          <TabButton current={activeTab} value="ai" onSelect={setActiveTab} icon={Sparkles}>Synthèse IA</TabButton>
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'overview' && <OverviewTab client={client} />}
        {activeTab === 'sales' && <SalesTab sales={client.sales} />}
        {activeTab === 'prescriptions' && (
          <PrescriptionsTab
            prescriptions={client.prescriptions}
            onAddClick={() => setPrescriptionModalOpen(true)}
          />
        )}
        {activeTab === 'appointments' && <AppointmentsTab appointments={client.appointments} />}
        {activeTab === 'ai' && <AiTab clientId={client.id} />}
      </div>

      <PrescriptionModal
        clientId={client.id}
        clientName={`${client.firstName} ${client.lastName}`}
        open={prescriptionModalOpen}
        onClose={() => setPrescriptionModalOpen(false)}
        onCreated={() => window.location.reload()}
      />
      <MarketingMessageModal
        clientId={client.id}
        clientName={`${client.firstName} ${client.lastName}`}
        open={marketingModalOpen}
        onClose={() => setMarketingModalOpen(false)}
      />
    </div>
  );
}

// ----- Tabs -----

function OverviewTab({ client }: { client: ClientDetail }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Section title="Informations">
        <InfoRow label="Civilité" value={client.gender === 'M' ? 'Homme' : client.gender === 'F' ? 'Femme' : '—'} />
        <InfoRow label="Date de naissance" value={client.birthDate ? formatDate(client.birthDate) : '—'} />
        <InfoRow label="Téléphone" value={client.phone ?? '—'} />
        <InfoRow label="Email" value={client.email ?? '—'} />
        <InfoRow label="Adresse" value={[client.addressLine1, client.postalCode, client.city].filter(Boolean).join(', ') || '—'} />
        <InfoRow label="Client depuis" value={formatDate(client.createdAt)} />
      </Section>
      <Section title="Préférences">
        <InfoRow label="Marques préférées" value={client.preferredBrands.length > 0 ? client.preferredBrands.join(', ') : '—'} />
        <InfoRow label="Budget moyen" value={client.averageBudget ? `${client.averageBudget} €` : '—'} />
        <InfoRow label="Notes" value={client.notes ?? '—'} multiline />
      </Section>
    </div>
  );
}

function SalesTab({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) return <EmptyState text="Aucun achat enregistré pour ce client." />;
  return (
    <div className="space-y-3">
      {sales.map((sale) => (
        <div key={sale.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{sale.reference}</span>
                <StatusBadge status={sale.status} />
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{formatDate(sale.createdAt)}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold text-slate-900">{formatEuros(Number(sale.totalTtc))} €</div>
              <div className="text-[11px] text-slate-400">{sale.items.length} article{sale.items.length > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            {sale.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700">
                  {item.product?.brand ? `${item.product.brand} — ` : ''}
                  {item.product?.name ?? item.description}
                  {item.quantity > 1 && <span className="text-slate-400"> × {item.quantity}</span>}
                </span>
                <span className="text-slate-500">{formatEuros(Number(item.totalTtc))} €</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrescriptionsTab({
  prescriptions,
  onAddClick,
}: {
  prescriptions: Prescription[];
  onAddClick: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onAddClick}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Nouvelle ordonnance
        </button>
      </div>
      {prescriptions.length === 0 ? (
        <EmptyState text="Aucune ordonnance enregistrée." />
      ) : (
        <div className="space-y-3">
          {prescriptions.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {p.type === 'GLASSES' ? 'Lunettes' : p.type === 'CONTACT_LENSES' ? 'Lentilles' : 'Examen'}
                    {p.doctorName && <span className="text-slate-500"> — {p.doctorName}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {p.issuedAt ? formatDate(p.issuedAt) : 'Date inconnue'}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                <EyeData side="OD (œil droit)" sphere={p.odSphere} cylinder={p.odCylinder} axis={p.odAxis} addition={p.odAddition} />
                <EyeData side="OG (œil gauche)" sphere={p.ogSphere} cylinder={p.ogCylinder} axis={p.ogAxis} addition={p.ogAddition} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentsTab({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) return <EmptyState text="Aucun rendez-vous." />;
  return (
    <div className="space-y-2">
      {appointments.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <div className="text-sm font-medium text-slate-900">{labelAppointmentType(a.type)}</div>
            <div className="text-xs text-slate-500">{formatDateTime(a.startsAt)}</div>
          </div>
          <StatusBadge status={a.status} />
        </div>
      ))}
    </div>
  );
}

function AiTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/ai/clients/summary', { clientId, forceRefresh });
      setData(res);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur génération synthèse');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate(false);
  }, [clientId]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-12 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-slate-500">Analyse IA en cours…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <AlertCircle className="mr-1.5 inline h-4 w-4" /> {error}
      </div>
    );
  }

  if (!data) return null;
  const payload = data.payload ?? data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          {data.cached ? 'Synthèse depuis le cache' : 'Synthèse générée à l\'instant'}
        </div>
        <button
          type="button"
          onClick={() => generate(true)}
          disabled={loading}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Régénération…' : 'Régénérer'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AiCard title="Profil" content={payload.profile} />
        <AiCard title="Vision" content={payload.vision} />
        <AiCard title="Habitudes d'achat" content={payload.purchaseHabits} />
        <AiCard title="Préférences" content={payload.preferences} />
      </div>

      {payload.recommendations && payload.recommendations.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-700">Actions recommandées</div>
          <div className="space-y-3">
            {payload.recommendations.map((r: any, i: number) => (
              <div key={i} className="rounded-lg bg-white p-3">
                <div className="text-sm font-medium text-slate-900">{r.action}</div>
                <div className="mt-1 text-xs text-slate-500">{r.rationale}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payload.tags && payload.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Tags IA :</span>
          {payload.tags.map((t: string) => (
            <span key={t} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">{t}</span>
          ))}
          {payload.segment && (
            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Segment : {payload.segment}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ----- Petits composants utilitaires -----

function Avatar({ firstName, lastName, large }: { firstName: string; lastName: string; large?: boolean }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const colors = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700'];
  const idx = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length;
  return (
    <div className={clsx('flex flex-shrink-0 items-center justify-center rounded-full font-semibold', large ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs', colors[idx])}>
      {initials}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TabButton({
  current, value, onSelect, icon: Icon, count, children,
}: { current: Tab; value: Tab; onSelect: (v: Tab) => void; icon: any; count?: number; children: React.ReactNode }) {
  const isActive = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={clsx(
        'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
        isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
      {count !== undefined && count > 0 && (
        <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>
          {count}
        </span>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={clsx(multiline ? 'flex flex-col' : 'flex items-start justify-between gap-3', 'text-sm')}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
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
    VALIDATED: { label: 'Validée', color: 'bg-emerald-50 text-emerald-700' },
    PENDING_REVIEW: { label: 'À valider', color: 'bg-amber-50 text-amber-700' },
    SCHEDULED: { label: 'Programmé', color: 'bg-blue-50 text-blue-700' },
    CONFIRMED: { label: 'Confirmé', color: 'bg-emerald-50 text-emerald-700' },
    COMPLETED: { label: 'Effectué', color: 'bg-emerald-50 text-emerald-700' },
    NO_SHOW: { label: 'Absent', color: 'bg-rose-50 text-rose-700' },
  };
  const info = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${info.color}`}>{info.label}</span>;
}

function EyeData({ side, sphere, cylinder, axis, addition }: { side: string; sphere: string | null; cylinder: string | null; axis: number | null; addition: string | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{side}</div>
      <div className="grid grid-cols-2 gap-1 text-slate-700">
        <span className="text-slate-400">Sphère</span><span>{sphere ?? '—'}</span>
        <span className="text-slate-400">Cylindre</span><span>{cylinder ?? '—'}</span>
        <span className="text-slate-400">Axe</span><span>{axis ?? '—'}</span>
        <span className="text-slate-400">Addition</span><span>{addition ?? '—'}</span>
      </div>
    </div>
  );
}

function AiCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <p className="text-sm leading-relaxed text-slate-800">{content}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">{text}</div>
  );
}

// ----- Helpers -----

function computeAge(birthDate: string): number {
  const d = new Date(birthDate);
  let age = new Date().getFullYear() - d.getFullYear();
  const m = new Date().getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--;
  return age;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatEuros(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function labelAppointmentType(t: string): string {
  return ({ EXAM: 'Examen', FITTING: 'Ajustement', PICKUP: 'Retrait', CONSULTATION: 'Consultation', OTHER: 'Autre' } as Record<string, string>)[t] ?? t;
}