'use client';

import { useCallback, useRef, useState } from 'react';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ name: string; arguments: any; result?: any }>;
  isStreaming?: boolean;
};

export type ChatStreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; name: string; arguments: any }
  | { type: 'tool_result'; name: string; result: any }
  | { type: 'done'; usage: { promptTokens: number; completionTokens: number; costUsd: number } }
  | { type: 'error'; message: string };

interface UseChatStreamOptions {
  apiUrl: string;
  getToken: () => string | null;
  storeId?: string;
  onError?: (msg: string) => void;
}

/**
 * Hook qui consomme /api/v1/ai/chat/stream en SSE via fetch + ReadableStream.
 * Gère un état local de messages + indicateur de streaming.
 */
export function useChatStream({ apiUrl, getToken, storeId, onError }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const token = getToken();
      if (!token) {
        onError?.('Vous devez être connecté.');
        return;
      }

      // Ajouter le message user immédiatement
      const userMsg: ChatMessage = {
        id: `tmp-user-${Date.now()}`,
        role: 'user',
        content: text,
      };
      const assistantMsgId = `tmp-asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
      ]);

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`${apiUrl}/api/v1/ai/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            conversationId,
            storeId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const block of lines) {
            const line = block.trim();
            if (!line.startsWith('data:')) continue;
            const json = line.slice(5).trim();
            if (!json) continue;

            try {
              const ev = JSON.parse(json) as ChatStreamEvent;
              applyEvent(ev, assistantMsgId);
            } catch {
              // ligne malformée — ignore
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          onError?.(err.message ?? 'Erreur de connexion');
        }
        // Finaliser le message si en cours
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m)),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }

      function applyEvent(ev: ChatStreamEvent, asstId: string) {
        if (ev.type === 'conversation') {
          setConversationId(ev.conversationId);
        } else if (ev.type === 'delta') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content: m.content + ev.content } : m,
            ),
          );
        } else if (ev.type === 'tool_call') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId
                ? {
                    ...m,
                    toolCalls: [
                      ...(m.toolCalls ?? []),
                      { name: ev.name, arguments: ev.arguments },
                    ],
                  }
                : m,
            ),
          );
        } else if (ev.type === 'tool_result') {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== asstId) return m;
              const calls = [...(m.toolCalls ?? [])];
              const last = calls.findLast((c) => c.name === ev.name && !c.result);
              if (last) last.result = ev.result;
              return { ...m, toolCalls: calls };
            }),
          );
        } else if (ev.type === 'done') {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, isStreaming: false } : m)),
          );
        } else if (ev.type === 'error') {
          onError?.(ev.message);
        }
      }
    },
    [apiUrl, conversationId, getToken, isStreaming, onError, storeId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  const loadConversation = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/api/v1/ai/chat/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        onError?.('Impossible de charger la conversation');
        return;
      }
      const data = await res.json();
      setConversationId(data.id);
      setMessages(
        (data.messages ?? [])
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content ?? '',
          })),
      );
    },
    [apiUrl, getToken, onError],
  );

  return {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    stop,
    reset,
    loadConversation,
  };
}
