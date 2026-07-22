'use client'

/**
 * DraftMessageScreen — full-page overlay for composing the first message.
 *
 * Wires together:
 *   MockCompany  →  MessageGenerator  →  DraftMessage  →  DraftMessageCard
 *
 * To swap in AI generation: pass a different `generator` prop (AIMessageGenerator).
 * The screen and card components require zero changes.
 */

import { useMemo, useState } from 'react'
import type { MockCompany } from '@/lib/search/types'
import type { MessageGenerator } from '@/lib/messaging/message-generator'
import { mockMessageGenerator } from '@/lib/messaging/mock-message-generator'
import { DraftMessageCard } from './draft-message-card'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DraftMessageScreenProps {
  company: MockCompany
  onBack: () => void
  /** Override the generator — defaults to MockMessageGenerator singleton. */
  generator?: MessageGenerator
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftMessageScreen({
  company,
  onBack,
  generator = mockMessageGenerator,
}: DraftMessageScreenProps) {
  // Generate once per company; memoised so re-renders don't regenerate.
  const draft = useMemo(() => generator.generate(company), [generator, company])

  // "Save for later" state — stub (no backend yet).
  const [savedNotice, setSavedNotice] = useState(false)

  const handleSaveLater = (_body: string) => {
    // TODO: persist to backend when available
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 3000)
  }

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
