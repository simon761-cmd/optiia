'use client';

import { useState } from 'react';
import {
  X,
  Mail,
  MessageSquare,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';

interface MarketingMessageModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
}

type Channel = 'email' | 'sms';
type Scenario =
  | 'reactivation_inactive_client'
  | 'prescription_renewal_due'
  | 'birthday_offer'
  | 'post_purchase_followup'
  | 'new_collection_announcement';

const SCENARIOS: { value: Scenario; label: string; description: string }[] = [
  { value: 'reactivation_inactive_client', label: 'Relance client inactif', description: 'Pour réveiller un client qui n\'est pas venu depuis longtemps' },
  { value: 'prescription_renewal_due', label: 'Ordonnance à renouveler', description: 'Le client a une ordonnance qui arrive à expiration' },
  { value: 'birthday_offer', label: 'Anniversaire', description: 'Offre spéciale pour son anniversaire' },
  { value: 'post_purchase_followup', label: 'Suivi post-achat', description: 'Demander si tout va bien après un achat récent' },
  { value: 'new_collection_announcement', label: 'Nouvelle collection', description: 'Annoncer une nouvelle collection ou marque' },
];

interface EmailMessage {
  subject: string;
  body: string;
  previewText: string;
  cta: { label: string; intent: string };
}

interface SmsMessage {
  message: string;
  characterCount: number;
}

interface GenerateResult {
  channel: Channel;
  scenario: Scenario;
  message: EmailMessage | SmsMessage;
  warnings: string[];
}

type Step = 'config' | 'generating' | 'result';

export function MarketingMessageModal({ clientId, clientName, open, onClose }: MarketingMessageModalProps) {
  const [step, setStep] = useState<Step>('config');
  const [channel, setChannel] = useState<Channel>('email');
  const [scenario, setScenario] = useState<Scenario>('reactivation_inactive_client');
  const [customNote, setCustomNote] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setStep('config');
    setChannel('email');
    setScenario('reactivation_inactive_client');
    setCustomNote('');
    setResult(null);
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    setError(null);
    setStep('generating');
    try {
      const res = await api.post<GenerateResult>('/api/v1/ai/marketing/message', {
        clientId,
        channel,
        scenario,
        customNote: customNote.trim() || undefined,
      });
      setResult(res);
      setStep('result');
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Erreur lors de la génération');
      setStep('config');
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    let text = '';
    if (result.channel === 'email') {
      const m = result.message as EmailMessage;
      text = `Sujet : ${m.subject}\n\n${m.body}`;
    } else {
      text = (result.message as SmsMessage).message;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback : sélection manuelle
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Générer un message</h2>
              <p className="text-xs text-slate-500">Pour {clientName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step: Config */}
          {step === 'config' && (
            <div className="space-y-5">
              {/* Canal */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-700">Canal</label>
                <div className="grid grid-cols-2 gap-3">
                  <ChannelButton
                    icon={Mail}
                    label="Email"
                    description="Sujet + corps + CTA"
                    active={channel === 'email'}
                    onClick={() => setChannel('email')}
                  />
                  <ChannelButton
                    icon={MessageSquare}
                    label="SMS"
                    description="Message court (≤160 car.)"
                    active={channel === 'sms'}
                    onClick={() => setChannel('sms')}
                  />
                </div>
              </div>

              {/* Scénario */}
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-700">Scénario</label>
                <div className="space-y-1.5">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setScenario(s.value)}
                      className={clsx(
                        'w-full rounded-lg border p-3 text-left transition',
                        scenario === s.value
                          ? 'border-indigo-200 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={clsx(
                          'mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2',
                          scenario === s.value ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300',
                        )} />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">{s.label}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{s.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note custom */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Note personnalisée <span className="text-slate-400">(optionnel)</span>
                </label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={2}
                  placeholder="Ex: 'Mentionne notre nouvelle collection Persol qui vient d'arriver'"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-4 text-sm font-medium text-slate-900">L'IA rédige votre message…</div>
              <div className="mt-1 text-xs text-slate-500">~3-5 secondes</div>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <ul className="space-y-0.5">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Email render */}
              {result.channel === 'email' ? (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Sujet</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">
                      {(result.message as EmailMessage).subject}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {(result.message as EmailMessage).previewText}
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                      {(result.message as EmailMessage).body}
                    </pre>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Bouton d'action</div>
                    <div className="mt-1 inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">
                      {(result.message as EmailMessage).cta.label}
                    </div>
                  </div>
                </div>
              ) : (
                /* SMS render */
                <div className="mx-auto max-w-sm">
                  <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-2 shadow-md">
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-[10px] font-medium uppercase text-slate-400 mb-1">SMS</div>
                      <div className="whitespace-pre-wrap text-sm text-slate-800">
                        {(result.message as SmsMessage).message}
                      </div>
                      <div className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
                        {(result.message as SmsMessage).characterCount} caractères
                        {(result.message as SmsMessage).characterCount > 160 && ' — sera segmenté'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'config' && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Sparkles className="h-4 w-4" />
              Générer le message
            </button>
          </div>
        )}

        {step === 'result' && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={() => setStep('config')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Régénérer
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white',
                  copied ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700',
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copier le message
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Sous-composants -----

function ChannelButton({
  icon: Icon, label, description, active, onClick,
}: { icon: any; label: string; description: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-lg border p-3 text-left transition',
        active ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className="flex items-center gap-2">
        <div className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500')}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className={clsx('text-sm font-medium', active ? 'text-indigo-900' : 'text-slate-900')}>{label}</div>
          <div className="text-[11px] text-slate-500">{description}</div>
        </div>
      </div>
    </button>
  );
}
