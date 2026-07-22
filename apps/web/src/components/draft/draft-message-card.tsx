'use client'

import { useState } from 'react'
import { Check, Copy, Clock, ArrowLeft, Mail, Phone, Zap, TrendingUp, MapPin, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockCompany, SignalType } from '@/lib/search/types'
import type { DraftMessage } from '@/lib/messaging/types'

// ─── Signal helpers ───────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SignalType, { icon: React.ElementType; color: string }> = {
  hiring:    { icon: Zap,        color: 'text-amber-400'   },
  growing:   { icon: TrendingUp, color: 'text-emerald-400' },
  expanding: { icon: MapPin,     color: 'text-blue-400'    },
  contract:  { icon: Star,       color: 'text-violet-400'  },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DraftMessageCardProps {
  company: MockCompany
  draft: DraftMessage
  onBack: () => void
  onSaveLater: (body: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftMessageCard({
  company,
  draft,
  onBack,
  onSaveLater,
}: DraftMessageCardProps) {
  const [body, setBody]     = useState(draft.body)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved]   = useState(false)

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea')
      el.value = body
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveLater = () => {
    onSaveLater(body)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── Back button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onBack}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-1.5',
          'text-xs font-medium text-muted-foreground',
          'hover:text-foreground hover:bg-accent transition-colors',
          '-ml-1',
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Назад к результатам
      </button>

      {/* ── Company & contact overview ───────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">

        {/* Company row */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
            {company.name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
            <p className="text-xs text-muted-foreground">
              {company.industry} · {company.region} · {company.size}
            </p>
          </div>
        </div>

        {/* Contact row */}
        <div className="flex items-start justify-between gap-4 pt-1 border-t border-border">
          <div>
            <p className="text-sm font-medium text-foreground">{company.contact.name}</p>
            <p className="text-xs text-muted-foreground">{company.contact.role}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <a
              href={`mailto:${company.contact.email}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-3 w-3 shrink-0" />
              {company.contact.email}
            </a>
            <a
              href={`tel:${company.contact.phone}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-3 w-3 shrink-0" />
              {company.contact.phone}
            </a>
          </div>
        </div>

        {/* Signals */}
        {company.signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
            {company.signals.map((signal) => {
              const { icon: Icon, color } = SIGNAL_CONFIG[signal.type]
              return (
                <div
                  key={signal.label}
                  className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1"
                >
                  <Icon className={cn('h-3 w-3 shrink-0', color)} />
                  <span className="text-xs text-foreground">{signal.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Draft message ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {/* Label */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Черновик письма
          </span>
          <span className="text-xs text-muted-foreground">
            Тема: {draft.subject}
          </span>
        </div>

        {/* Editable body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          spellCheck
          className={cn(
            'w-full resize-none bg-transparent',
            'px-4 py-4 text-sm text-foreground leading-relaxed',
            'focus-visible:outline-none',
            'placeholder:text-muted-foreground',
          )}
        />
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3',
            'text-sm font-semibold transition-all',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Скопировать
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSaveLater}
          className={cn(
            'flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3',
            'text-sm font-semibold transition-all',
            'border border-border bg-card text-foreground',
            'hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              Сохранено
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              Отправить позже
            </>
          )}
        </button>
      </div>

    </div>
  )
}
