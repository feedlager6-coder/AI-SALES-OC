'use client'

import { useState } from 'react'
import { CheckCircle2, HelpCircle, ArrowRight, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParsedIntent, ConfirmedIntent } from '@/lib/intent/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface InteractiveIntentCardProps {
  rawQuery: string
  intent: ParsedIntent
  onConfirm: (result: ConfirmedIntent) => void
  onEdit: () => void
}

// ─── Parameter row ─────────────────────────────────────────────────────────────

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
      <span className="text-sm text-foreground">
        <span className="text-muted-foreground">{label}:</span>{' '}
        <span className="font-medium">{value}</span>
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * InteractiveIntentCard
 *
 * Displays the system's interpretation of the user's natural-language query
 * and asks for confirmation before starting the search.
 *
 * Design rules (from docs/20-product-reboot-v2.md):
 * - Max 3–4 parameters shown
 * - Max 1 clarifying question
 * - "Всё верно, искать" always visible — never force the user to answer the question
 * - No internal terms (Hunt, ICP, Pipeline, etc.)
 */
export function InteractiveIntentCard({
  rawQuery,
  intent,
  onConfirm,
  onEdit,
}: InteractiveIntentCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  const params: Array<{ label: string; value: string }> = [
    intent.industry   && { label: 'Отрасль', value: intent.industry },
    intent.region     && { label: 'Регион',  value: intent.region   },
    intent.companySize && { label: 'Размер',  value: intent.companySize },
  ].filter((p): p is { label: string; value: string } => Boolean(p))

  // If we parsed nothing useful, show the raw query so the card is never empty
  const hasParams = params.length > 0

  const handleConfirm = () => {
    onConfirm({
      parsed: intent,
      rawQuery,
      clarifyingAnswer: selectedAnswer,
    })
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">

      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <p className="text-sm font-semibold text-foreground">
          Вот как я понял ваш запрос
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          «{rawQuery}»
        </p>
      </div>

      {/* Parameters */}
      <div className="px-5 py-4 space-y-3">
        {hasParams ? (
          params.map((p) => (
            <ParamRow key={p.label} label={p.label} value={p.value} />
          ))
        ) : (
          // Fallback: couldn't extract structured params — show raw query as-is
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              <span className="text-muted-foreground">Запрос:</span>{' '}
              <span className="font-medium">{rawQuery}</span>
            </span>
          </div>
        )}
      </div>

      {/* Clarifying question */}
      {intent.clarifyingQuestion && (
        <div className="px-5 py-4 border-t border-border/60 space-y-3">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              {intent.clarifyingQuestion.text}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pl-7">
            {intent.clarifyingQuestion.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setSelectedAnswer(
                    selectedAnswer === opt.value ? null : opt.value,
                  )
                }
                className={cn(
                  'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all',
                  selectedAnswer === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 border-t border-border flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          className={cn(
            'flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'text-sm font-semibold transition-all',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          Всё верно, искать
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'text-sm font-medium transition-all',
            'border border-border bg-card text-muted-foreground',
            'hover:border-border/80 hover:text-foreground hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Уточнить
        </button>
      </div>
    </div>
  )
}
