import { useState, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AISource {
  sourceType: string;
  sourceId: string;
  snippet: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AISource[];
  timestamp: Date;
  isError?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const ACCESS_TOKEN_KEY = 'pp_access_token';
const SESSION_STORAGE_KEY = 'ai_chat_messages';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function loadMessages(): AIMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<AIMessage, 'timestamp'> & { timestamp: string }>;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(messages: AIMessage[]): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage quota exceeded — ignore
  }
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface UseAIChatReturn {
  messages: AIMessage[];
  isStreaming: boolean;
  sendMessage: (
    query: string,
    intent: string,
    context?: Record<string, string>,
  ) => void;
  clearChat: () => void;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<AIMessage[]>(loadMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateMessages = useCallback((updater: (prev: AIMessage[]) => AIMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      saveMessages(next);
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    (query: string, intent: string, context?: Record<string, string>) => {
      if (!query.trim() || isStreaming) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Add user message
      const userMsg: AIMessage = {
        id: generateId(),
        role: 'user',
        content: query.trim(),
        timestamp: new Date(),
      };

      // Placeholder assistant message
      const assistantId = generateId();
      const assistantMsg: AIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date(),
      };

      updateMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const token = localStorage.getItem(ACCESS_TOKEN_KEY);

      (async () => {
        try {
          const response = await fetch(`${BASE_URL}/ai/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ intent, query: query.trim(), context }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Request failed (${response.status}): ${errText}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let accumulatedContent = '';
          let accumulatedSources: AISource[] = [];

          const flush = () => {
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();

              if (!trimmed || trimmed.startsWith(':')) continue; // skip comments/heartbeat

              if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.slice(5).trim();

                if (dataStr === '[DONE]') {
                  // Stream complete
                  return;
                }

                try {
                  const parsed = JSON.parse(dataStr) as {
                    delta?: string;
                    content?: string;
                    sources?: AISource[];
                    done?: boolean;
                  };

                  if (parsed.delta !== undefined) {
                    accumulatedContent += parsed.delta;
                  } else if (parsed.content !== undefined) {
                    accumulatedContent += parsed.content;
                  }

                  if (parsed.sources) {
                    accumulatedSources = parsed.sources;
                  }

                  // Update the assistant message in state
                  updateMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...msg,
                            content: accumulatedContent,
                            sources: accumulatedSources,
                          }
                        : msg,
                    ),
                  );
                } catch {
                  // Non-JSON data line — treat as raw text delta
                  if (dataStr && dataStr !== '[DONE]') {
                    accumulatedContent += dataStr;
                    updateMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantId
                          ? { ...msg, content: accumulatedContent }
                          : msg,
                      ),
                    );
                  }
                }
              }
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            flush();
          }

          // Flush remaining
          if (buffer.trim()) {
            buffer += '\n';
            flush();
          }

          // Finalize — if content is empty after stream, show placeholder
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantId && msg.content === ''
                ? { ...msg, content: 'I was unable to generate a response. Please try again.' }
                : msg,
            );
            saveMessages(updated);
            return updated;
          });
        } catch (err: unknown) {
          if ((err as Error).name === 'AbortError') return;

          const errorMsg = err instanceof Error ? err.message : 'An error occurred.';
          updateMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: `Sorry, something went wrong: ${errorMsg}`,
                    isError: true,
                  }
                : msg,
            ),
          );
        } finally {
          setIsStreaming(false);
        }
      })();
    },
    [isStreaming, updateMessages],
  );

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, sendMessage, clearChat };
}
