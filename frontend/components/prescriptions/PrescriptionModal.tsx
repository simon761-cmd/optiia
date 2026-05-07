'use client';

import { useState, useRef } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/lib/api';

interface PrescriptionModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface OcrResult {
  data: {
    isPrescription: boolean;
    confidence: number;
    rightEye: { sphere: number | null; cylinder: number | null; axis: number | null; addition: number | null } | null;
    leftEye: { sphere: number | null; cylinder: number | null; axis: number | null; addition: number | null } | null;
    prescriberName: string | null;
    prescribedAt: string | null;
    prescriptionType: 'GLASSES' | 'CONTACT_LENSES' | 'BOTH' | null;
    pupillaryDistance: number | null;
    warnings: string[];
    autoValidated: boolean;
  };
}

type Step = 'choice' | 'upload' | 'analyzing' | 'review' | 'saving';

export function PrescriptionModal({ clientId, clientName, open, onClose, onCreated }: PrescriptionModalProps) {
  const [step, setStep] = useState<Step>('choice');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: 'GLASSES' as 'GLASSES' | 'CONTACT_LENSES' | 'EXAM',
    doctorName: '',
    issuedAt: '',
    odSphere: '', odCylinder: '', odAxis: '', odAddition: '',
    ogSphere: '', ogCylinder: '', ogAxis: '', ogAddition: '',
    pupillaryDistance: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setStep('choice');
    setImagePreview(null);
    setOcrResult(null);
    setError(null);
    setForm({
      type: 'GLASSES',
      doctorName: '', issuedAt: '',
      odSphere: '', odCylinder: '', odAxis: '', odAddition: '',
      ogSphere: '', ogCylinder: '', ogAxis: '', ogAddition: '',
      pupillaryDistance: '',
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelected = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError('Image trop lourde (max 10 Mo)');
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setImagePreview(dataUrl);
    setStep('analyzing');

    try {
      const result = await api.post<OcrResult>('/api/v1/prescriptions/ocr/extract', {
        imageDataUrl: dataUrl,
      });
      setOcrResult(result);

      const d = result.data;
      setForm({
        type: (d.prescriptionType === 'BOTH' ? 'GLASSES' : d.prescriptionType) ?? 'GLASSES',
        doctorName: d.prescriberName ?? '',
        issuedAt: d.prescribedAt ?? '',
        odSphere: d.rightEye?.sphere?.toString() ?? '',
        odCylinder: d.rightEye?.cylinder?.toString() ?? '',
        odAxis: d.rightEye?.axis?.toString() ?? '',
        odAddition: d.rightEye?.addition?.toString() ?? '',
        ogSphere: d.leftEye?.sphere?.toString() ?? '',
        ogCylinder: d.leftEye?.cylinder?.toString() ?? '',
        ogAxis: d.leftEye?.axis?.toString() ?? '',
        ogAddition: d.leftEye?.addition?.toString() ?? '',
        pupillaryDistance: d.pupillaryDistance?.toString() ?? '',
      });

      setStep('review');
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Erreur lors de l\'analyse OCR');
      setStep('upload');
    }
  };

  const handleSave = async () => {
    setError(null);
    setStep('saving');
    try {
      await api.post('/api/v1/prescriptions', {
        clientId,
        type: form.type,
        doctorName: form.doctorName || undefined,
        issuedAt: form.issuedAt || undefined,
        od: {
          sphere: parseNum(form.odSphere),
          cylinder: parseNum(form.odCylinder),
          axis: parseInt2(form.odAxis),
          addition: parseNum(form.odAddition),
        },
        og: {
          sphere: parseNum(form.ogSphere),
          cylinder: parseNum(form.ogCylinder),
          axis: parseInt2(form.ogAxis),
          addition: parseNum(form.ogAddition),
        },
        pupillaryDistance: parseInt2(form.pupillaryDistance),
      });
      onCreated?.();
      handleClose();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
      setStep('review');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nouvelle ordonnance</h2>
            <p className="text-xs text-slate-500">Pour {clientName}</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'choice' && (
            <div className="space-y-3">
              <ChoiceCard
                icon={Camera}
                title="Photographier l'ordonnance"
                subtitle="L'IA va lire les valeurs automatiquement"
                badge="Recommandé"
                accent
                onClick={() => setStep('upload')}
              />
              <ChoiceCard
                icon={Upload}
                title="Saisir manuellement"
                subtitle="Tape les valeurs à la main"
                onClick={() => setStep('review')}
              />
            </div>
          )}

          {step === 'upload' && (
            <div>
              <button
                type="button"
                onClick={() => setStep('choice')}
                className="mb-3 text-xs text-slate-500 hover:text-slate-700"
              >
                ← Retour
              </button>

              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 transition hover:border-indigo-300 hover:bg-indigo-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                  <Camera className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="text-sm font-medium text-slate-900">Clique pour sélectionner une image</div>
                <div className="mt-1 text-xs text-slate-500">PNG, JPEG ou HEIC — 10 Mo max</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
              </div>

              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Ordonnance"
                  className="mb-4 max-h-48 rounded-lg border border-slate-200 object-contain"
                />
              )}
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Analyse de l'ordonnance par l'IA…
              </div>
              <div className="mt-1 text-xs text-slate-500">~3-8 secondes</div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {ocrResult && (
                <div className={clsx(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                  ocrResult.data.autoValidated
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                    : 'border-amber-100 bg-amber-50 text-amber-800',
                )}>
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {ocrResult.data.autoValidated
                        ? `IA confiante (${Math.round(ocrResult.data.confidence * 100)}%) — vérifie quand même les valeurs`
                        : `Vigilance : confiance ${Math.round(ocrResult.data.confidence * 100)}% — relis bien chaque champ`}
                    </div>
                    {(ocrResult.data.warnings?.length ?? 0) > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {ocrResult.data.warnings.map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setOcrResult(null);
                        reset();
                        setStep('upload');
                      }}
                      className="rounded p-1 hover:bg-white/50"
                      title="Réessayer avec une autre image"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Type</label>
                <div className="flex gap-2">
                  {(['GLASSES', 'CONTACT_LENSES', 'EXAM'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={clsx(
                        'rounded-lg border px-3 py-2 text-xs font-medium',
                        form.type === t
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {t === 'GLASSES' ? 'Lunettes' : t === 'CONTACT_LENSES' ? 'Lentilles' : 'Examen'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom du médecin" value={form.doctorName} onChange={(v) => setForm((f) => ({ ...f, doctorName: v }))} placeholder="Dr. Lambert" />
                <Field label="Date de l'ordonnance" type="date" value={form.issuedAt?.slice(0, 10) ?? ''} onChange={(v) => setForm((f) => ({ ...f, issuedAt: v }))} />
              </div>

              <EyeFields
                title="Œil droit (OD)"
                accent="indigo"
                values={{ sphere: form.odSphere, cylinder: form.odCylinder, axis: form.odAxis, addition: form.odAddition }}
                onChange={(field, value) => setForm((f) => ({ ...f, [`od${capitalize(field)}`]: value }))}
              />

              <EyeFields
                title="Œil gauche (OG)"
                accent="emerald"
                values={{ sphere: form.ogSphere, cylinder: form.ogCylinder, axis: form.ogAxis, addition: form.ogAddition }}
                onChange={(field, value) => setForm((f) => ({ ...f, [`og${capitalize(field)}`]: value }))}
              />

              <Field label="Écart pupillaire (mm)" type="number" value={form.pupillaryDistance} onChange={(v) => setForm((f) => ({ ...f, pupillaryDistance: v }))} placeholder="62" />

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'review' || step === 'saving') && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={step === 'saving'}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={step === 'saving'}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
            >
              {step === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Enregistrer l'ordonnance
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({
  icon: Icon, title, subtitle, badge, accent, onClick,
}: { icon: any; title: string; subtitle: string; badge?: string; accent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition',
        accent
          ? 'border-indigo-200 bg-indigo-50/50 hover:border-indigo-300 hover:bg-indigo-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className={clsx(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
        accent ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600',
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{title}</span>
          {badge && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </button>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>
      <input
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function EyeFields({
  title, accent, values, onChange,
}: {
  title: string;
  accent: 'indigo' | 'emerald';
  values: { sphere: string; cylinder: string; axis: string; addition: string };
  onChange: (field: 'sphere' | 'cylinder' | 'axis' | 'addition', value: string) => void;
}) {
  const accentColor = accent === 'indigo' ? 'text-indigo-700' : 'text-emerald-700';
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <h4 className={clsx('mb-2 text-xs font-semibold uppercase tracking-wide', accentColor)}>{title}</h4>
      <div className="grid grid-cols-4 gap-2">
        <MiniField label="Sphère" value={values.sphere} onChange={(v) => onChange('sphere', v)} placeholder="-2.50" />
        <MiniField label="Cylindre" value={values.cylinder} onChange={(v) => onChange('cylinder', v)} placeholder="-0.75" />
        <MiniField label="Axe" value={values.axis} onChange={(v) => onChange('axis', v)} placeholder="90" />
        <MiniField label="Add." value={values.addition} onChange={(v) => onChange('addition', v)} placeholder="2.00" />
      </div>
    </div>
  );
}

function MiniField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseNum(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? undefined : n;
}

function parseInt2(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
