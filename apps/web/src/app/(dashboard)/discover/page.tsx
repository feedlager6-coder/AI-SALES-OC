'use client'

import { useCallback, useRef, useState } from 'react'
import { Search, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseIntentMock } from '@/lib/intent/parse-intent-mock'
import { InteractiveIntentCard } from '@/components/discover/interactive-intent-card'
import { SearchProgress } from '@/components/discover/search-progress'
import { SearchResults } from '@/components/discover/search-results'
import { searchCompanies } from '@/lib/search/mock-search-service'
import type { ConfirmedIntent, ParsedIntent } from '@/lib/intent/types'
import type { SearchResult } from '@/lib/search/types'

// ─── Phase machine ────────────────────────────────────────────────────────────
//
//   search → confirm → searching → results
//     ↑_________________________________|   (new search)
//   confirm → search                        (edit)
//

type Phase = 'search' | 'confirm' | 'searching' | 'results'

// ─── Example queries ──────────────────────────────────────────────────────────

const EXAMPLES = [
  'Строительные компании в Москве',
  'Юридические фирмы в Казани',
  'Логистические компании с 20–100 сотрудниками',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [phase, setPhase]               = useState<Phase>('search')
  const [query, setQuery]               = useState('')
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const textareaRef                     = useRef<HTMLTextAreaElement>(null)

  // Stores the search promise result while the animation plays
  const pendingResultRef = useRef<SearchResult | null>(null)

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
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleEdit = () => {
    setPhase('search')
    setTimeout(() => {
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }, 0)
  }

  const handleConfirm = (result: ConfirmedIntent) => {
    pendingResultRef.current = null
    setPhase('searching')

    // Fire search in parallel with the animation (~2.4s).
    // The animation lasts ~3.3s, so data is ready before it finishes.
    searchCompanies({
      rawQuery:        result.rawQuery,
      industry:        result.parsed.industry,
      region:          result.parsed.region,
      companySize:     result.parsed.companySize,
      clarifyingAnswer: result.clarifyingAnswer,
    }).then((data) => {
      pendingResultRef.current = data
    })
  }

  // Called by SearchProgress when the animation finishes
  const handleSearchAnimationComplete = useCallback(() => {
    const data = pendingResultRef.current
    if (data) {
      setSearchResult(data)
      setPhase('results')
    } else {
      // Fallback: data arrived late — poll briefly
      const interval = setInterval(() => {
        if (pendingResultRef.current) {
          clearInterval(interval)
          setSearchResult(pendingResultRef.current)
          setPhase('results')
        }
      }, 100)
    }
  }, [])

  const handleNewSearch = () => {
    setQuery('')
    setParsedIntent(null)
    setSearchResult(null)
    pendingResultRef.current = null
    setPhase('search')
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  // ── Layout helpers ──────────────────────────────────────────────────────────

  // Results use the full content width; other phases use a centred narrow column
  const isResultsPhase = phase === 'results'

  return (
    <div className={cn(
      'px-4',
      isResultsPhase
        ? 'py-6'
        : 'flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]',
    )}>
      <div className={cn(
        'w-full',
        isResultsPhase ? 'max-w-3xl mx-auto' : 'max-w-2xl space-y-8',
      )}>

        {/* ── Header (hidden on results) ──────────────────────────────────── */}
        {!isResultsPhase && (
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
        )}

        {/* ── Phase: search ─────────────────────────────────────────────── */}
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
                      'transition-all duration-150 group flex items-center justify-between',
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

        {/* ── Phase: confirm ────────────────────────────────────────────── */}
        {phase === 'confirm' && parsedIntent && (
          <InteractiveIntentCard
            rawQuery={query}
            intent={parsedIntent}
            onConfirm={handleConfirm}
            onEdit={handleEdit}
          />
        )}

        {/* ── Phase: searching ──────────────────────────────────────────── */}
        {phase === 'searching' && (
          <SearchProgress
            query={query}
            onComplete={handleSearchAnimationComplete}
          />
        )}

        {/* ── Phase: results ────────────────────────────────────────────── */}
        {phase === 'results' && searchResult && (
          <SearchResults
            result={searchResult}
            onNewSearch={handleNewSearch}
          />
        )}

      </div>
    </div>
  )
}
