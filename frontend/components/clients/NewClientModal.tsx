'use client';

import { useState } from 'react';
import { X, Loader2, Check, AlertCircle, UserPlus, Mail } from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (clientId: string) => void;
}

export function NewClientModal({ open, onClose, onCreated }: NewClientModalProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '' as '' | 'M' | 'F' | 'OTHER',
    addressLine1: '',
    postalCode: '',
    city: '',
    notes: '',
    marketingConsent: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setForm({
      firstName: '', lastName: '', email: '', phone: '', birthDate: '',
      gender: '', addressLine1: '', postalCode: '', city: '', notes: '',
      marketingConsent: false,
    });
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires');
      return;
    }
    if (form.email && !form.email.includes('@')) {
      setError('Email invalide');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };
      if (form.email.trim()) payload.email = form.email.trim().toLowerCase();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.birthDate) payload.birthDate = form.birthDate;
      if (form.gender) payload.gender = form.gender;
      if (form.addressLine1.trim()) payload.addressLine1 = form.addressLine1.trim();
      if (form.postalCode.trim()) payload.postalCode = form.postalCode.trim();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.marketingConsent) {
        payload.marketingConsent = true;
        payload.marketingConsentAt = new Date().toISOString();
      }

      const created = await api.post<{ id: string }>('/api/v1/clients', payload);
      onCreated?.(created.id);
      reset();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erreur lors de la création du client');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <UserPlus className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nouveau client</h2>
              <p className="text-xs text-slate-500">Crée une fiche client</p>
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
          {/* Identité */}
          <Section title="Identité">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *" required value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} placeholder="Marie" />
              <Field label="Nom *" required value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} placeholder="Dupont" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de naissance" type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Civilité</label>
                <div className="flex gap-1.5">
                  {(['M', 'F', 'OTHER'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm({ ...form, gender: form.gender === g ? '' : g })}
                      className={clsx(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition',
                        form.gender === g
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {g === 'M' ? 'Homme' : g === 'F' ? 'Femme' : 'Autre'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="marie@exemple.fr" />
              <Field label="Téléphone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="06 12 34 56 78" />
            </div>
          </Section>

          {/* Adresse */}
          <Section title="Adresse" optional>
            <Field label="Adresse" value={form.addressLine1} onChange={(v) => setForm({ ...form, addressLine1: v })} placeholder="12 rue des Lilas" />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Code postal" value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} placeholder="44000" />
              <div className="col-span-2">
                <Field label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Nantes" />
              </div>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes" optional>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Notes internes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Ex: Préfère les montures en acétate, allergique au métal…"
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </Section>

          {/* Consentement marketing */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  <Mail className="h-3.5 w-3.5 text-indigo-600" />
                  Consentement marketing
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Le client accepte de recevoir des messages commerciaux (relances, anniversaires, nouvelles collections). Obligatoire pour utiliser les outils marketing.
                </p>
              </div>
            </label>
          </div>

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
            disabled={loading || !form.firstName.trim() || !form.lastName.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Créer le client
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
  label, required, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}
