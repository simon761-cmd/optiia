'use client';

import { useState, useEffect } from 'react';
import {
  X, Loader2, Check, AlertCircle, Package, Glasses, Eye, Layers, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  product?: any;
}

const CATEGORIES = [
  { value: 'FRAME', label: 'Monture', icon: Glasses },
  { value: 'LENS', label: 'Verre', icon: Eye },
  { value: 'CONTACT_LENS', label: 'Lentille', icon: Eye },
  { value: 'ACCESSORY', label: 'Accessoire', icon: Layers },
  { value: 'SOLUTION', label: 'Solution', icon: Sparkles },
] as const;

type CategoryValue = typeof CATEGORIES[number]['value'];

const FRAME_SHAPES = ['Rectangle', 'Carrée', 'Ronde', 'Aviator', 'Œil de chat', 'Papillon', 'Mixte'];
const FRAME_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const LENS_TREATMENTS = ['AR', 'BLUE_LIGHT', 'PHOTOCHROMIC', 'POLARIZED', 'HYDROPHOBIC'];

export function ProductModal({ open, onClose, onSaved, product }: ProductModalProps) {
  const isEdit = !!product;

  const [form, setForm] = useState({
    sku: '',
    name: '',
    brand: '',
    category: 'FRAME' as CategoryValue,
    subcategory: '',
    sellPriceTtc: '',
    costPriceHt: '',
    vatRate: '20',
    frameMaterial: '',
    frameColor: '',
    frameShape: '',
    frameSize: '',
    lensIndex: '',
    lensTreatment: [] as string[],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && product) {
      setForm({
        sku: product.sku ?? '',
        name: product.name ?? '',
        brand: product.brand ?? '',
        category: product.category ?? 'FRAME',
        subcategory: product.subcategory ?? '',
        sellPriceTtc: product.sellPriceTtc?.toString() ?? '',
        costPriceHt: product.costPriceHt?.toString() ?? '',
        vatRate: product.vatRate?.toString() ?? '20',
        frameMaterial: product.frameMaterial ?? '',
        frameColor: product.frameColor ?? '',
        frameShape: product.frameShape ?? '',
        frameSize: product.frameSize ?? '',
        lensIndex: product.lensIndex?.toString() ?? '',
        lensTreatment: Array.isArray(product.lensTreatment) ? product.lensTreatment : [],
      });
    } else if (open) {
      setForm({
        sku: '', name: '', brand: '', category: 'FRAME', subcategory: '',
        sellPriceTtc: '', costPriceHt: '', vatRate: '20',
        frameMaterial: '', frameColor: '', frameShape: '', frameSize: '',
        lensIndex: '', lensTreatment: [],
      });
    }
    setError(null);
  }, [open, product]);

  if (!open) return null;

  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    if (!form.sku.trim() || !form.name.trim()) {
      setError('Le SKU et le nom sont obligatoires');
      return;
    }
    const sellPrice = parseFloat(form.sellPriceTtc.replace(',', '.'));
    if (isNaN(sellPrice) || sellPrice < 0) {
      setError('Prix de vente invalide');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category,
        sellPriceTtc: sellPrice,
        vatRate: form.vatRate ? parseFloat(form.vatRate) : 20,
      };
      if (form.brand.trim()) payload.brand = form.brand.trim();
      if (form.subcategory.trim()) payload.subcategory = form.subcategory.trim();
      if (form.costPriceHt) payload.costPriceHt = parseFloat(form.costPriceHt.replace(',', '.'));

      if (form.category === 'FRAME') {
        if (form.frameMaterial) payload.frameMaterial = form.frameMaterial;
        if (form.frameColor) payload.frameColor = form.frameColor;
        if (form.frameShape) payload.frameShape = form.frameShape;
        if (form.frameSize) payload.frameSize = form.frameSize;
      }
      if (form.category === 'LENS') {
        if (form.lensIndex) payload.lensIndex = parseFloat(form.lensIndex);
        if (form.lensTreatment.length > 0) payload.lensTreatment = form.lensTreatment;
      }

      if (isEdit) {
        await api.patch(`/api/v1/products/${product.id}`, payload);
      } else {
        await api.post('/api/v1/products', payload);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const toggleTreatment = (t: string) => {
    setForm((f) => ({
      ...f,
      lensTreatment: f.lensTreatment.includes(t)
        ? f.lensTreatment.filter((x) => x !== t)
        : [...f.lensTreatment, t],
    }));
  };

  const vatRate = parseFloat(form.vatRate || '20');
  const sellTtc = parseFloat(form.sellPriceTtc);
  const costHt = parseFloat(form.costPriceHt);
  const showMargin = !isNaN(sellTtc) && !isNaN(costHt) && sellTtc > 0 && costHt > 0;
  const marginHt = showMargin ? sellTtc / (1 + vatRate / 100) - costHt : 0;
  const marginPct = showMargin ? (marginHt / costHt) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <Package className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? 'Modifie les informations du produit' : 'Ajoute un nouveau produit au catalogue'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Catégorie */}
          <Section title="Catégorie">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition',
                    form.category === c.value
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <c.icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {c.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Identification */}
          <Section title="Identification">
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU *" required value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} placeholder="RB-WAY-001" />
              <Field label="Marque" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} placeholder="Ray-Ban" />
            </div>
            <Field label="Nom *" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Wayfarer Classic" />
          </Section>

          {/* Prix */}
          <Section title="Prix">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prix vente TTC *" required type="number" value={form.sellPriceTtc} onChange={(v) => setForm({ ...form, sellPriceTtc: v })} placeholder="159" suffix="€" />
              <Field label="Coût HT" type="number" value={form.costPriceHt} onChange={(v) => setForm({ ...form, costPriceHt: v })} placeholder="65" suffix="€" />
              <Field label="TVA" type="number" value={form.vatRate} onChange={(v) => setForm({ ...form, vatRate: v })} placeholder="20" suffix="%" />
            </div>
            {showMargin && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Marge brute : {marginHt.toFixed(2)} € ({marginPct.toFixed(0)}%)
              </div>
            )}
          </Section>

          {/* Frame specific */}
          {form.category === 'FRAME' && (
            <Section title="Caractéristiques monture" optional>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Matière" value={form.frameMaterial} onChange={(v) => setForm({ ...form, frameMaterial: v })} placeholder="Acétate" />
                <Field label="Couleur" value={form.frameColor} onChange={(v) => setForm({ ...form, frameColor: v })} placeholder="Noir" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Forme</label>
                  <select
                    value={form.frameShape}
                    onChange={(e) => setForm({ ...form, frameShape: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">—</option>
                    {FRAME_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Taille</label>
                  <select
                    value={form.frameSize}
                    onChange={(e) => setForm({ ...form, frameSize: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">—</option>
                    {FRAME_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </Section>
          )}

          {/* Lens specific */}
          {form.category === 'LENS' && (
            <Section title="Caractéristiques verre" optional>
              <Field label="Indice" type="number" value={form.lensIndex} onChange={(v) => setForm({ ...form, lensIndex: v })} placeholder="1.6" />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Traitements</label>
                <div className="flex flex-wrap gap-1.5">
                  {LENS_TREATMENTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTreatment(t)}
                      className={clsx(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        form.lensTreatment.includes(t)
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !form.sku || !form.name || !form.sellPriceTtc}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {isEdit ? 'Sauvegarder' : 'Créer le produit'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, optional, children }: { title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
        {optional && <span className="ml-1.5 font-normal normal-case text-slate-400">— optionnel</span>}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label, required, value, onChange, type = 'text', placeholder, suffix,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={type}
          step={type === 'number' ? 'any' : undefined}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100',
            suffix && 'pr-8',
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
