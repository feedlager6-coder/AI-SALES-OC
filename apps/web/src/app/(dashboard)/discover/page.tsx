'use client'

import { useCallback, useRef, useState } from 'react'
import { Search, ArrowRight, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseIntent } from '@/lib/intent/intent-api'
import { InteractiveIntentCard } from '@/components/discover/interactive-intent-card'
import { SearchProgress } from '@/components/discover/search-progress'
import { SearchResults } from '@/components/discover/search-results'
import { huntService } from '@/lib/search/hunt-service'
import { createHunt } from '@/lib/hunt/hunt-api'
import type { Hunt } from '@/lib/hunt/hunt-api'
import type { ConfirmedIntent, ParsedIntent } from '@/lib/intent/types'
import type { SearchResult } from '@/lib/search/types'

// ─── Phase machine ────────────────────────────────────────────────────────────
//
//   search → confirm → searching → results
//     ↑_________________________________|   (new search)
//   confirm → search                        (edit)
//   searching → error                       (hunt creation or provider failure)
//

type Phase = 'search' | 'confirm' | 'searching' | 'results' | 'error'

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
  const [isParsing, setIsParsing]       = useState(false)
  const [parseError, setParseError]     = useState<string | null>(null)
  const textareaRef                     = useRef<HTMLTextAreaElement>(null)

  // Stores the search promise result while the animation plays
  const pendingResultRef  = useRef<SearchResult | null>(null)
  // Set to true when hunt creation or search rejects
  const searchFailedRef   = useRef<boolean>(false)
  // Active hunt — used to update status after search settles
  const activeHuntRef     = useRef<Hunt | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isParsing) return
    setIsParsing(true)
    setParseError(null)
    try {
      const intent = await parseIntent(trimmed)
      setParsedIntent(intent)
      setPhase('confirm')
    } catch (err: unknown) {
      console.error('[DiscoverPage] Intent parse failed:', err)
      setParseError('Не удалось обработать запрос. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      setIsParsing(false)
    }
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

  /**
   * Called when the user confirms their intent.
   *
   * New flow (v2):
   *   Intent confirmed
   *     → POST /api/v1/hunts   (create Hunt, get huntId)
   *     → PATCH hunt status → 'confirmed'
   *     → huntService.search(hunt)   (providers receive the full Hunt)
   *     → PATCH hunt status → 'completed' | 'failed'
   *
   * The animation runs in parallel (~3s). Hunt creation + search fire
   * immediately; results are stored in pendingResultRef and handed to the
   * UI once the animation finishes (see handleSearchAnimationComplete).
   */
  const handleConfirm = (result: ConfirmedIntent) => {
    pendingResultRef.current  = null
    searchFailedRef.current   = false
    activeHuntRef.current     = null
    setPhase('searching')

    // Fire the full Hunt lifecycle asynchronously so the animation can run.
    ;(async () => {
      let hunt: Hunt | null = null
      try {
        // Step 1 — Persist the Hunt before touching any search provider.
        hunt = await createHunt({
          rawQuery: result.rawQuery,
          intentJson: {
            industry:         result.parsed.industry,
            region:           result.parsed.region,
            companySize:      result.parsed.companySize,
            clarifyingAnswer: result.clarifyingAnswer,
          },
        })
        activeHuntRef.current = hunt

        // Step 2 — Execute search on the API server.
        // POST /api/v1/hunts/:id/search runs all providers, dedup, and ranking.
        // The backend manages status transitions (searching → completed | failed).
        const data = await huntService.search(hunt)
        pendingResultRef.current = data
      } catch (err: unknown) {
        console.error('[DiscoverPage] Hunt creation or search failed:', err)
        searchFailedRef.current = true
      }
    })()
  }

  // Called by SearchProgress when the animation finishes
  const handleSearchAnimationComplete = useCallback(() => {
    // Immediate resolution — data already arrived
    if (pendingResultRef.current) {
      setSearchResult(pendingResultRef.current)
      setPhase('results')
      return
    }

    // Immediate failure — hunt creation or provider already rejected
    if (searchFailedRef.current) {
      setPhase('error')
      return
    }

    // Fallback: data or error hasn't arrived yet — poll for up to 5 s then fail
    const TIMEOUT_MS = 5_000
    const started    = Date.now()
    const interval   = setInterval(() => {
      if (pendingResultRef.current) {
        clearInterval(interval)
        setSearchResult(pendingResultRef.current)
        setPhase('results')
      } else if (searchFailedRef.current || Date.now() - started >= TIMEOUT_MS) {
        clearInterval(interval)
        setPhase('error')
      }
    }, 100)
  }, [])

  const handleNewSearch = () => {
    setQuery('')
    setParsedIntent(null)
    setSearchResult(null)
    pendingResultRef.current  = null
    searchFailedRef.current   = false
    activeHuntRef.current     = null
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
                disabled={!query.trim() || isParsing}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3',
                  'text-sm font-semibold transition-all',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Анализируем запрос…
                  </>
                ) : (
                  <>
                    Найти клиентов
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {parseError && (
              <p className="text-xs text-destructive text-center -mt-2">{parseError}</p>
            )}

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

        {/* ── Phase: error ──────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="text-center space-y-4 py-12">
            <p className="text-muted-foreground text-sm">
              Не удалось выполнить поиск. Попробуйте ещё раз.
            </p>
            <button
              type="button"
              onClick={handleNewSearch}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-6 py-3',
                'text-sm font-semibold bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              Новый поиск
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
