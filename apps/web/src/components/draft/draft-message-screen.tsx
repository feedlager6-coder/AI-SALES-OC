'use client'

/**
 * DraftMessageScreen — full-page overlay for composing the first message.
 *
 * Generates an AI-personalised draft via the backend on mount, shows a
 * loading spinner while waiting, then hands the result to DraftMessageCard.
 *
 * "Save for later" persists the draft to the backend activities table.
 */

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockCompany } from '@/lib/search/types'
import type { DraftMessage } from '@/lib/messaging/types'
import { aiMessageGenerator } from '@/lib/messaging/ai-message-generator'
import { DraftMessageCard } from './draft-message-card'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DraftMessageScreenProps {
  company: MockCompany
  onBack: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftMessageScreen({ company, onBack }: DraftMessageScreenProps) {
  const [draft, setDraft]         = useState<DraftMessage | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [retryKey, setRetryKey]   = useState(0)

  // Generate once per company (or on retry). Cancel if the component unmounts.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    aiMessageGenerator
      .generate(company)
      .then((d) => {
        if (!cancelled) {
          setDraft(d)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error('[DraftMessageScreen] Generation failed:', err)
          setError('Не удалось сгенерировать письмо. Попробуйте ещё раз.')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [company, retryKey])

  // Persist the current (possibly edited) body to the backend.
  const handleSaveLater = (body: string) => {
    if (!draft) return
    void (async () => {
      try {
        const res = await fetch('/api/v1/drafts', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: draft.subject,
            body,
            companyInfo: {
              name: company.name,
              industry: company.industry,
              region: company.region,
              inn: company.inn ?? null,
            },
          }),
        })
        if (!res.ok) {
          console.warn('[DraftMessageScreen] Save failed:', res.status)
        }
      } catch (err) {
        console.warn('[DraftMessageScreen] Save error:', err)
      }
    })()

    // Show confirmation immediately — don't wait for the network
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 3000)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Генерируем персонализированное письмо…
        </p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error || !draft) {
    return (
      <div className="text-center space-y-4 py-16">
        <p className="text-sm text-destructive">
          {error ?? 'Не удалось сгенерировать письмо.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5',
              'text-sm font-semibold bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <RefreshCw className="h-4 w-4" />
            Попробовать снова
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    )
  }

  // ── Draft ready ──────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      <DraftMessageCard
        company={company}
        draft={draft}
        onBack={onBack}
        onSaveLater={handleSaveLater}
      />

      {/* Save confirmation toast */}
      {savedNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg text-sm text-foreground">
            Черновик сохранён — отправите позже
          </div>
        </div>
      )}
    </div>
  )
}
