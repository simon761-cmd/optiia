'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Square, Sparkles, Wrench, RotateCcw, Bot, User2 } from 'lucide-react';
import clsx from 'clsx';

import { useChatStream, type ChatMessage } from './useChatStream';

interface ChatPanelProps {
  apiUrl: string;
  /** Fonction qui retourne le JWT — typiquement depuis un store auth */
  getToken: () => string | null;
  storeId?: string;
  /** Affiché en empty state */
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  'Quels clients je peux relancer cette semaine ?',
  'Quel est mon chiffre d’affaires ce mois-ci ?',
  'Quels produits sont en rupture imminente ?',
  'Top 5 des meilleures ventes du mois',
];

export function ChatPanel({
  apiUrl,
  getToken,
  storeId,
  suggestions = DEFAULT_SUGGESTIONS,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, sendMessage, stop, reset } = useChatStream({
    apiUrl,
    getToken,
    storeId,
    onError: setErrorMsg,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setErrorMsg(null);
    setInput('');
    void sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-1.5">
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">OptiIA</h2>
            <p className="text-xs text-slate-500">Assistant boutique</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              reset();
              setErrorMsg(null);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Nouveau
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState suggestions={suggestions} onPick={(s) => setInput(s)} />
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Erreur */}
      {errorMsg && (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-200 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Pose ta question…"
            className="max-h-32 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-slate-900 p-2 text-white hover:bg-slate-700"
              aria-label="Arrêter"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-slate-400">
          OptiIA peut faire des erreurs. Vérifie les chiffres importants.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-3 rounded-full bg-indigo-50 p-3">
        <Sparkles className="h-6 w-6 text-indigo-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Bonjour 👋</h3>
      <p className="mb-4 max-w-xs text-xs text-slate-500">
        Je peux interroger ventes, stock et clients de ta boutique.
      </p>
      <div className="grid w-full max-w-md gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-slate-900"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={clsx(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          isUser ? 'bg-slate-900 text-white' : 'bg-indigo-100 text-indigo-700',
        )}
      >
        {isUser ? <User2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
          isUser
            ? 'rounded-tr-sm bg-slate-900 text-white'
            : 'rounded-tl-sm bg-slate-100 text-slate-900',
        )}
      >
        {/* Tool calls visibles si présents */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-1.5 space-y-1">
            {message.toolCalls.map((tc, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md bg-white/60 px-2 py-1 text-[11px] text-slate-600"
              >
                <Wrench className="h-3 w-3" />
                <span className="font-mono">{tc.name}</span>
                {tc.result ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="animate-pulse text-slate-400">…</span>
                )}
              </div>
            ))}
          </div>
        )}

        {message.content ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
            {message.isStreaming && <BlinkCursor />}
          </div>
        ) : message.isStreaming ? (
          <BlinkCursor />
        ) : null}
      </div>
    </div>
  );
}

function BlinkCursor() {
  return <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />;
}
