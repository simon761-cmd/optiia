'use client';

import { useEffect, useState } from 'react';
import {
  Search, Loader2, Package, AlertCircle, Plus, Edit2, Trash2,
  Glasses, Eye, Layers, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';
import { ProductModal } from '@/components/products/ProductModal';

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  sellPriceTtc: string;
  costPriceHt: string | null;
  vatRate: string;
  frameMaterial: string | null;
  frameColor: string | null;
  frameShape: string | null;
  frameSize: string | null;
  lensIndex: string | null;
  lensTreatment: string[];
  supplier?: { id: string; name: string } | null;
}

interface ProductsResponse {
  data: Product[];
}

type CategoryFilter = 'all' | 'FRAME' | 'LENS' | 'CONTACT_LENS' | 'ACCESSORY' | 'SOLUTION';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string; icon: any }[] = [
  { value: 'all', label: 'Tous', icon: Package },
  { value: 'FRAME', label: 'Montures', icon: Glasses },
  { value: 'LENS', label: 'Verres', icon: Eye },
  { value: 'CONTACT_LENS', label: 'Lentilles', icon: Eye },
  { value: 'ACCESSORY', label: 'Accessoires', icon: Layers },
  { value: 'SOLUTION', label: 'Solutions', icon: Sparkles },
];

const CATEGORY_LABELS: Record<string, string> = {
  FRAME: 'Monture',
  LENS: 'Verre',
  CONTACT_LENS: 'Lentille',
  ACCESSORY: 'Accessoire',
  SOLUTION: 'Solution',
};

const CATEGORY_COLORS: Record<string, string> = {
  FRAME: 'bg-indigo-50 text-indigo-700',
  LENS: 'bg-emerald-50 text-emerald-700',
  CONTACT_LENS: 'bg-amber-50 text-amber-700',
  ACCESSORY: 'bg-pink-50 text-pink-700',
  SOLUTION: 'bg-cyan-50 text-cyan-700',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('limit', '200');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);

    api
      .get<ProductsResponse>(`/api/v1/products?${params}`)
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Impossible de charger les produits');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedSearch, categoryFilter, refreshKey]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/products/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Produits</h1>
          <p className="text-sm text-slate-500">
            {loading ? 'Chargement…' : `${products.length} produit${products.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Nouveau produit
        </button>
      </div>

      {/* Filtres catégorie */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setCategoryFilter(f.value)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
              categoryFilter === f.value
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            <f.icon className="h-3.5 w-3.5" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, marque ou SKU…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

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
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {debouncedSearch
                ? `Aucun produit pour "${debouncedSearch}"`
                : 'Aucun produit dans ce catalogue'}
            </p>
            {!debouncedSearch && (
              <button
                type="button"
                onClick={handleNew}
                className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Ajouter ton premier produit
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Prix TTC</th>
                <th className="px-4 py-3 text-right">Marge</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const sellTtc = Number(p.sellPriceTtc);
                const costHt = p.costPriceHt ? Number(p.costPriceHt) : null;
                const vatRate = Number(p.vatRate);
                const sellHt = sellTtc / (1 + vatRate / 100);
                const margin = costHt !== null ? sellHt - costHt : null;
                const marginPercent = costHt !== null && costHt > 0 ? (margin! / costHt) * 100 : null;

                return (
                  <tr key={p.id} className="transition hover:bg-slate-50/40">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {p.brand && <span className="text-slate-500">{p.brand} — </span>}
                        {p.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {p.category === 'FRAME' && (
                          [p.frameColor, p.frameShape, p.frameSize].filter(Boolean).join(' · ')
                        )}
                        {p.category === 'LENS' && (
                          <>
                            {p.lensIndex && `Indice ${p.lensIndex}`}
                            {p.lensTreatment.length > 0 && ` · ${p.lensTreatment.join(', ')}`}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        CATEGORY_COLORS[p.category] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {sellTtc.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {margin !== null ? (
                        <div>
                          <div className="font-medium text-emerald-700">{margin.toFixed(2)} €</div>
                          {marginPercent !== null && (
                            <div className="text-[10px] text-slate-500">{marginPercent.toFixed(0)}%</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                          title="Modifier"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(p)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
        product={editingProduct}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Supprimer ce produit ?</h3>
                <p className="text-xs text-slate-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-700">
              Tu vas supprimer{' '}
              <strong>
                {deleteConfirm.brand ? `${deleteConfirm.brand} ` : ''}{deleteConfirm.name}
              </strong>{' '}
              du catalogue.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:bg-rose-300"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Suppression…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
