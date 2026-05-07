'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/lib/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Composant qui protège ses enfants.
 * Si l'utilisateur n'est pas connecté → redirection vers /login.
 * Pendant la vérification → affiche un spinner.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (isHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [isHydrated, accessToken, router]);

  // Pendant l'hydratation initiale (lecture du localStorage)
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Si pas connecté, on attend la redirection (rien à afficher)
  if (!accessToken) return null;

  return <>{children}</>;
}