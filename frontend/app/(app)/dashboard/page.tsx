'use client';

import { ChatPanel } from '@/components/ai/ChatPanel';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { useAuthStore } from '@/lib/auth-store';

export default function HomePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const getToken = () => accessToken;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Bonjour {user?.firstName ?? ''} 👋
          </h1>
          <p className="text-sm text-slate-500">Voici votre tableau de bord OptiIA</p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Dashboard principal */}
          <div className="xl:col-span-2">
            <DashboardOverview />
          </div>

          {/* Panneau IA latéral */}
          <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <ChatPanel apiUrl={apiUrl} getToken={getToken} />
          </aside>
        </div>
      </div>
    </main>
  );
}
