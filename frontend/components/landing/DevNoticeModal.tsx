'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Wrench } from 'lucide-react';

const STORAGE_KEY = 'optiia-dev-notice-seen';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function DevNoticeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (!lastSeen || Date.now() - parseInt(lastSeen, 10) > ONE_DAY_MS) {
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 px-6 py-8 text-center">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Wrench className="h-7 w-7 text-white" />
          </div>

          <h2 className="relative text-xl font-bold text-white">
            Site en cours de développement
          </h2>
          <p className="relative mt-1 text-sm text-white/80">
            Bienvenue sur OptiIA ✨
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="space-y-3 text-sm leading-relaxed text-slate-700">
            <p>
              Merci pour votre visite ! OptiIA est un projet <strong>actuellement en cours de développement</strong>.
            </p>
            <p>
              Certaines fonctionnalités peuvent encore évoluer ou comporter des bugs. Vos retours sont les bienvenus pour améliorer le produit.
            </p>
            <p className="text-slate-600">
              N'hésitez pas à explorer, tester et me partager vos impressions via le formulaire de contact en bas de page.
            </p>
          </div>

          {/* Signature */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-sm font-medium italic text-slate-600">— Simon</span>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleClose}
            className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            J'ai compris, continuer
          </button>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            Ce message ne s'affichera qu'une fois par 24h
          </p>
        </div>
      </div>
    </div>
  );
}
