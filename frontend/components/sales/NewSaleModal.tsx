'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X, Loader2, Check, AlertCircle, Search, Plus, Minus, Trash2, ShoppingBag, User,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';

interface NewSaleModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (saleId: string) => void;
  preselectedClientId?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  sellPriceTtc: string;
  vatRate: string;
}

interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  FRAME: 'Monture',
  LENS: 'Verre',
  CONTACT_LENS: 'Lentille',
  ACCESSORY: 'Accessoire',
  SOLUTION: 'Solution',
};

export function NewSaleModal({ open, onClose, onCreated, preselectedClientId }: NewSaleModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId ?? null);
  const [clientSearch, setClientSearch] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [status, setStatus] = useState<'PENDING' | 'READY' | 'DELIVERED' | 'QUOTE'>('PENDING');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      api.get<{ data: Client[] }>('/api/v1/clients?limit=100'),
      api.get<{ data: Product[] }>('/api/v1/products?limit=200').catch(() => ({ data: [] })),
    ])
      .then(([cRes, pRes]) => {
        setClients(Array.isArray(cRes) ? cRes : (cRes as any).data ?? []);
        const prods = Array.isArray(pRes) ? pRes : (pRes as any).data ?? [];
        setProducts(prods);
      })
      .catch(() => setError('Impossible de charger clients ou produits'))
      .finally(() => setLoadingData(false));
  }, [open]);

  const reset = () => {
    setSelectedClientId(preselectedClientId ?? null);
    setClientSearch('');
    setProductSearch('');
    setCart([]);
    setStatus('PENDING');
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) { reset(); onClose(); }
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
    const q = clientSearch.toLowerCase();
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [clients, clientSearch]);

  const filteredProducts = useMemo(() => {
    const inCart = new Set(cart.map((c) => c.productId));
    let list = products.filter((p) => !inCart.has(p.id));
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 8);
  }, [products, productSearch, cart]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const addToCart = (product: Product) => {
    setCart((c) => [...c, { productId: product.id, product, quantity: 1 }]);
    setProductSearch('');
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((c) =>
      c.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setCart((c) => c.filter((item) => item.productId !== productId));
  };

  const totals = useMemo(() => {
    let subtotalHt = 0;
    let totalTtc = 0;
    for (const item of cart) {
      const sellTtc = Number(item.product.sellPriceTtc);
      const vatRate = Number(item.product.vatRate);
      const unitHt = sellTtc / (1 + vatRate / 100);
      subtotalHt += unitHt * item.quantity;
      totalTtc += sellTtc * item.quantity;
    }
    return { subtotalHt, vat: totalTtc - subtotalHt, totalTtc };
  }, [cart]);

  const handleSubmit = async () => {
    if (!selectedClientId) { setError('Sélectionne un client'); return; }
    if (cart.length === 0) { setError('Ajoute au moins un produit'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/api/v1/sales', {
        clientId: selectedClientId,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
        status,
      });
      onCreated?.(created.id);
      reset();
      onClose();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <ShoppingBag className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nouvelle vente</h2>
              <p className="text-xs text-slate-500">Crée une vente pour un client</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-5">

              {/* 1. Client */}
              <Section title="1. Client" icon={User}>
                {selectedClient ? (
                  <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {selectedClient.firstName} {selectedClient.lastName}
                      </div>
                      {selectedClient.email && (
                        <div className="text-xs text-slate-500">{selectedClient.email}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClientId(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Rechercher un client (nom, prénom, email)…"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    {filteredClients.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-100">
                        {filteredClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedClientId(c.id); setClientSearch(''); }}
                            className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{c.firstName} {c.lastName}</div>
                              {c.email && <div className="text-xs text-slate-500">{c.email}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredClients.length === 0 && clientSearch && (
                      <div className="mt-2 rounded-lg border border-dashed border-slate-200 py-3 text-center text-xs text-slate-500">
                        Aucun client trouvé pour "{clientSearch}"
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* 2. Articles */}
              <Section title="2. Articles" icon={ShoppingBag}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Rechercher un produit (nom, marque, SKU)…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {filteredProducts.length > 0 && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-100">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {p.brand && <span className="text-slate-500">{p.brand} — </span>}
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                            <span>{p.sku}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{Number(p.sellPriceTtc).toFixed(2)} €</span>
                          <Plus className="h-4 w-4 text-indigo-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {productSearch && filteredProducts.length === 0 && (
                  <div className="mt-2 rounded-lg border border-dashed border-slate-200 py-3 text-center text-xs text-slate-500">
                    Aucun produit trouvé
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Panier ({cart.length} article{cart.length > 1 ? 's' : ''})
                    </div>
                    {cart.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {item.product.brand && <span className="text-slate-500">{item.product.brand} — </span>}
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{Number(item.product.sellPriceTtc).toFixed(2)} € l'unité</div>
                        </div>
                        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => updateQty(item.productId, -1)}
                            disabled={item.quantity <= 1}
                            className="px-2 py-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.productId, 1)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-900"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="w-20 text-right text-sm font-semibold text-slate-900">
                          {(Number(item.product.sellPriceTtc) * item.quantity).toFixed(2)} €
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="space-y-1 border-t border-slate-200 pt-2 text-sm">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Sous-total HT</span>
                        <span>{totals.subtotalHt.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>TVA</span>
                        <span>{totals.vat.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-900">
                        <span>Total TTC</span>
                        <span>{totals.totalTtc.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                )}
              </Section>

              {/* 3. Statut */}
              <Section title="3. Statut" icon={Check}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['QUOTE', 'PENDING', 'READY', 'DELIVERED'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={clsx(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition',
                        status === s
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {s === 'QUOTE' ? 'Devis' : s === 'PENDING' ? 'En cours' : s === 'READY' ? 'Prête' : 'Livré'}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  {status === 'DELIVERED' && '✓ La vente est marquée comme payée intégralement.'}
                  {status === 'READY' && 'Le client peut venir retirer sa commande.'}
                  {status === 'PENDING' && 'En attente de production / livraison fournisseur.'}
                  {status === 'QUOTE' && 'Devis non engageant.'}
                </p>
              </Section>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedClientId || cart.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Créer la vente{totals.totalTtc > 0 && ` (${totals.totalTtc.toFixed(2)} €)`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
