'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles, LayoutDashboard, Users, Package, Calendar, LogOut, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/lib/auth-store';

const NAV_ITEMS = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/ventes', label: 'Ventes', icon: ShoppingBag },
  { href: '/produits', label: 'Produits', icon: Package, disabled: true },
  { href: '/agenda', label: 'Agenda', icon: Calendar, disabled: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-50">
        {/* Sidebar */}
        <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
          {/* Logo */}
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">OptiIA</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300"
                    title="Bientôt disponible"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      bientôt
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Utilisateur en bas */}
          <div className="border-t border-slate-200 p-3">
            {user && (
              <div className="mb-2 px-2 py-1">
                <div className="text-xs font-medium text-slate-900">
                  {user.firstName} {user.lastName}
                </div>
                <div className="truncate text-[11px] text-slate-500">{user.email}</div>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </aside>

        {/* Contenu */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}