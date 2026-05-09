'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  UserPlus,
  Phone,
  Mail,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { NewClientModal } from '@/components/clients/NewClientModal';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  city: string | null;
  tags: string[];
  createdAt: string;
}

interface ClientsResponse {
  data: Client[];
  nextCursor?: string | null;
}

export default function ClientsPage() {
  const router = useRouter();
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce de la recherche (attend 300ms après la dernière frappe)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Charger les clients (au montage et à chaque changement de recherche)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('limit', '50');
    if (debouncedSearch) params.set('search', debouncedSearch);

    api
      .get<ClientsResponse | Client[]>(`/api/v1/clients?${params}`)
      .then((res) => {
        if (cancelled) return;
        // Le backend peut renvoyer soit { data: [...] } soit directement [...]
        const data = Array.isArray(res) ? res : res.data ?? [];
        setClients(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Impossible de charger les clients');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, refreshKey]);

  const computeAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const d = new Date(birthDate);
    let age = new Date().getFullYear() - d.getFullYear();
    const m = new Date().getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--;
    return age;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">
            {loading
              ? 'Chargement…'
              : `${clients.length} client${clients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          onClick={() => setNewClientOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Nouveau client
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom ou email…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {debouncedSearch
              ? `Aucun client trouvé pour "${debouncedSearch}"`
              : 'Aucun client pour le moment'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Âge</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => {
                const age = computeAge(c.birthDate);
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer transition hover:bg-indigo-50/40"
                    onClick={() => router.push(`/clients/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={c.firstName} lastName={c.lastName} />
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className="text-xs text-slate-400">
                            #{c.id.slice(-6)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs">
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{c.email}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="h-3 w-3" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {c.city ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {age !== null ? `${age} ans` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
                          c.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                            >
                              {tag}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NewClientModal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ----------- Avatar avec initiales -----------

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  // Couleur déterministe basée sur les initiales
  const colors = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
  ];
  const idx = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length;
  return (
    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colors[idx]}`}>
      {initials}
    </div>
  );
}