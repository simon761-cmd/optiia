'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Loader2 } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && accessToken) router.replace('/dashboard');
  }, [isHydrated, accessToken, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post(
        '/api/v1/auth/signup',
        { companyName, firstName, lastName, email, password },
        { skipAuth: true },
      );
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      router.replace('/dashboard');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erreur de connexion au serveur');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">OptiIA</h1>
          <p className="mt-1 text-sm text-slate-500">Créez votre boutique en 30 secondes</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Créer un compte</h2>
          <p className="mb-5 text-sm text-slate-500">14 jours d'essai gratuit, sans CB</p>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Nom de la boutique" value={companyName} onChange={setCompanyName} placeholder="Optique Martin" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" value={firstName} onChange={setFirstName} placeholder="Simon" />
              <Field label="Nom" value={lastName} onChange={setLastName} placeholder="Martin" />
            </div>
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="simon@optique-martin.fr" autoComplete="email" />
            <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="8 caractères minimum" autoComplete="new-password" />

            {error && (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !companyName || !firstName || !lastName || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création en cours…
                </>
              ) : (
                'Créer ma boutique'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// ----------- Composant Field réutilisable -----------

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}

function Field({ label, value, onChange, type = 'text', placeholder, autoComplete }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>
      <input
        type={type}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}