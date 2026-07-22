'use client'

import { useRef, useState } from 'react'
import { Search, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseIntentMock } from '@/lib/intent/parse-intent-mock'
import { InteractiveIntentCard } from '@/components/discover/interactive-intent-card'
import type { ConfirmedIntent, ParsedIntent } from '@/lib/intent/types'

// ─── Page phases ──────────────────────────────────────────────────────────────

type Phase = 'search' | 'confirm' | 'done'

// ─── Example queries ──────────────────────────────────────────────────────────

const EXAMPLES = [
  'Строительные компании в Москве',
  'Юридические фирмы в Казани',
  'Логистические компании с 20–100 сотрудниками',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [phase, setPhase] = useState<Phase>('search')
  const [query, setQuery] = useState('')
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null)
  const [confirmed, setConfirmed] = useState<ConfirmedIntent | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    const intent = parseIntentMock(trimmed)
    setParsedIntent(intent)
    setPhase('confirm')
  }

  const handleExample = (text: string) => {
    setQuery(text)
    setPhase('search')
    // Focus textarea after setting value so user can edit
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleEdit = () => {
    setPhase('search')
    setTimeout(() => {
      textareaRef.current?.focus()
      // Move cursor to end
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }, 0)
  }

  const handleConfirm = (result: ConfirmedIntent) => {
    setConfirmed(result)
    setPhase('done')
  }

  const handleReset = () => {
    setQuery('')
    setParsedIntent(null)
    setConfirmed(null)
    setPhase('search')
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4">
      <div className="w-full max-w-2xl space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Кого вы ищете?
          </h1>
          <p className="text-muted-foreground text-sm">
            Опишите целевую аудиторию — мы найдём подходящих клиентов
          </p>
        </div>

        {/* ── Phase: search ───────────────────────────────────────────────── */}
        {phase === 'search' && (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground pointer-events-none" />
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  rows={3}
                  placeholder="Например: строительные компании в Москве с 50–200 сотрудниками"
                  className={cn(
                    'w-full resize-none rounded-xl border border-border bg-card',
                    'pl-12 pr-4 py-4 text-sm text-foreground',
                    'placeholder:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'hover:border-border/80 transition-colors',
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={!query.trim()}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3',
                  'text-sm font-semibold transition-all',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                Найти клиентов
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Examples */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
                Примеры запросов
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExample(example)}
                    className={cn(
                      'w-full text-left rounded-lg border border-border bg-card px-4 py-3',
                      'text-sm text-muted-foreground hover:text-foreground',
                      'hover:border-primary/30 hover:bg-accent',
                      'transition-all duration-150',
                      'group flex items-center justify-between',
                    )}
                  >
                    <span>{example}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Phase: confirm (Interactive Intent) ─────────────────────────── */}
        {phase === 'confirm' && parsedIntent && (
          <InteractiveIntentCard
            rawQuery={query}
            intent={parsedIntent}
            onConfirm={handleConfirm}
            onEdit={handleEdit}
          />
        )}

        {/* ── Phase: done (stub — real results go here in next sprint) ─────── */}
        {phase === 'done' && confirmed && (
          <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="px-5 py-4 border-b border-border bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-semibold text-foreground">
                  Запрос подтверждён
                </p>
              </div>
            </div>
            <div className="px-5 py-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Здесь появятся результаты поиска.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Следующий этап разработки — подключение реального поиска компаний.
              </p>
            </div>
            <div className="px-5 pb-5 text-center">
              <button
                type="button"
                onClick={handleReset}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2',
                  'text-sm font-medium text-muted-foreground',
                  'border border-border hover:border-border/80 hover:text-foreground hover:bg-accent',
                  'transition-all',
                )}
              >
                Новый поиск
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
