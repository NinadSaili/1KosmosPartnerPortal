import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useAIChat, type AIMessage, type AISource } from '@/hooks/useAIChat';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

// ─── Constants ─────────────────────────────────────────────────────────────────

const INTENTS = [
  { value: 'search_training', label: 'Search Training' },
  { value: 'search_resources', label: 'Search Resources' },
  { value: 'generate_proposal', label: 'Generate Proposal' },
  { value: 'recommend_course', label: 'Recommend Course' },
  { value: 'general', label: 'General' },
] as const;

type IntentValue = (typeof INTENTS)[number]['value'];

const VERTICALS = [
  'Financial Services',
  'Healthcare',
  'Government',
  'Retail',
  'Manufacturing',
  'Technology',
  'Education',
  'Energy',
];

// ─── Source Citations ──────────────────────────────────────────────────────────

interface SourceCitationsProps {
  sources: AISource[];
}

function SourceCitations({ sources }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {sources.length} source{sources.length !== 1 ? 's' : ''}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden mt-2 flex flex-wrap gap-1.5"
          >
            {sources.map((source, idx) => (
              <a
                key={idx}
                href={`/${source.sourceType}s/${source.sourceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                title={source.snippet}
              >
                <span className="capitalize">{source.sourceType}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Chat Message ──────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: AIMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
}

function ChatMessage({ message, isLastAssistant, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[80%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : message.isError
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-tl-sm'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm',
          )}
        >
          {message.isError && (
            <AlertCircle className="h-4 w-4 inline mr-1.5 -mt-0.5 text-red-500" />
          )}
          {message.content || (
            isLastAssistant && isStreaming ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </span>
            ) : null
          )}
          {/* Streaming cursor */}
          {isLastAssistant && isStreaming && message.content && (
            <span className="inline-block w-0.5 h-3.5 bg-gray-500 dark:bg-gray-400 animate-pulse ml-0.5 -mb-0.5" />
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}

        {/* Timestamp */}
        <p className={cn('text-[10px] text-gray-400 dark:text-gray-500', isUser ? 'text-right' : 'text-left')}>
          {format(message.timestamp, 'h:mm a')}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Intent Context Fields ────────────────────────────────────────────────────

interface IntentContextFieldsProps {
  intent: IntentValue;
  context: Record<string, string>;
  onChange: (context: Record<string, string>) => void;
}

function IntentContextFields({ intent, context, onChange }: IntentContextFieldsProps) {
  if (intent === 'generate_proposal') {
    return (
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Vertical
            </label>
            <select
              value={context.vertical ?? ''}
              onChange={(e) => onChange({ ...context, vertical: e.target.value })}
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select vertical</option>
              {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Pain Point
            </label>
            <input
              type="text"
              value={context.painPoint ?? ''}
              onChange={(e) => onChange({ ...context, painPoint: e.target.value })}
              placeholder="e.g. fraud prevention"
              className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Drawer ────────────────────────────────────────────────────────────────────

interface AIChatDrawerProps {
  /** Controlled open state (optional). If omitted, the component manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AIChatDrawer({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: AIChatDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (val: boolean) => {
      if (controlledOnOpenChange) controlledOnOpenChange(val);
      else setInternalOpen(val);
    },
    [controlledOnOpenChange],
  );

  const { user } = useAuth();
  const { messages, isStreaming, sendMessage, clearChat } = useAIChat();
  const [intent, setIntent] = useState<IntentValue>('general');
  const [intentContext, setIntentContext] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Auto-send recommend_course on intent change if user is logged in
  useEffect(() => {
    if (intent === 'recommend_course' && open && user) {
      sendMessage(
        'Based on my training progress, what courses do you recommend I take next?',
        'recommend_course',
        { userId: user.id },
      );
    }
  }, [intent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    const query = input.trim();
    setInput('');
    sendMessage(query, intent, Object.keys(intentContext).length > 0 ? intentContext : undefined);
  }, [input, isStreaming, intent, intentContext, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const lastAssistantIndex = messages.reduce(
    (last, msg, idx) => (msg.role === 'assistant' ? idx : last),
    -1,
  );

  // Find if there are no assistant messages yet (welcome state)
  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Drawer */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:max-w-[420px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
            aria-describedby="ai-chat-description"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <Dialog.Title className="text-sm font-semibold text-gray-900 dark:text-white">
                    AI Assistant
                  </Dialog.Title>
                  <Dialog.Description id="ai-chat-description" className="text-xs text-gray-500 dark:text-gray-400">
                    Powered by 1Kosmos knowledge base
                  </Dialog.Description>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={clearChat}
                    aria-label="Clear chat"
                    title="Clear chat history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close">
                    <X className="h-4 w-4" />
                  </Button>
                </Dialog.Close>
              </div>
            </div>

            {/* Intent selector */}
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                  Intent
                </label>
                <Select
                  value={intent}
                  onChange={(e) => {
                    setIntent(e.target.value as IntentValue);
                    setIntentContext({});
                  }}
                  className="h-8 text-xs flex-1"
                >
                  {INTENTS.map((i) => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Intent-specific context fields */}
            <IntentContextFields
              intent={intent}
              context={intentContext}
              onChange={setIntentContext}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {!hasMessages && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                    <Sparkles className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    How can I help you today?
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px]">
                    Ask me about training courses, resources, proposals, or anything about the 1Kosmos partner program.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLastAssistant={idx === lastAssistantIndex}
                    isStreaming={isStreaming}
                  />
                ))}
              </AnimatePresence>

              {/* Typing indicator when streaming but assistant message is empty */}
              {isStreaming &&
                messages[messages.length - 1]?.role === 'assistant' &&
                messages[messages.length - 1]?.content === '' && (
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
              <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    intent === 'generate_proposal'
                      ? 'Describe the customer scenario…'
                      : intent === 'search_training'
                      ? 'Search training materials…'
                      : intent === 'search_resources'
                      ? 'Search resources…'
                      : 'Ask anything…'
                  }
                  rows={1}
                  disabled={isStreaming}
                  className="flex-1 bg-transparent resize-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none leading-relaxed max-h-[120px] py-0.5"
                  aria-label="Chat input"
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg"
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send message"
                >
                  {isStreaming ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 text-center">
                Shift+Enter for new line · Enter to send
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
