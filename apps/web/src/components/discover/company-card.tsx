'use client'

import { useEffect } from 'react'
import {
  X, Mail, Phone, SkipForward,
  Zap, TrendingUp, MapPin, Star,
  Building2, Users, Globe, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockCompany, SignalType } from '@/lib/search/types'

// ─── Signal helpers ───────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SignalType, { icon: React.ElementType; color: string }> = {
  hiring:    { icon: Zap,        color: 'text-amber-400'  },
  growing:   { icon: TrendingUp, color: 'text-emerald-400' },
  expanding: { icon: MapPin,     color: 'text-blue-400'   },
  contract:  { icon: Star,       color: 'text-violet-400' },
}

function SignalBadge({ label, type }: { label: string; type: SignalType }) {
  const { icon: Icon, color } = SIGNAL_CONFIG[type]
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
      <span className="text-xs text-foreground">{label}</span>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CompanyCardProps {
  company: MockCompany
  onClose: () => void
  onWrite: (company: MockCompany) => void
  onSkip: (company: MockCompany) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyCard({ company, onClose, onWrite, onSkip }: CompanyCardProps) {
  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative z-10 w-full sm:max-w-lg',
        'bg-card border border-border',
        'rounded-t-2xl sm:rounded-2xl',
        'max-h-[92dvh] overflow-y-auto',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
      )}>

        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">{company.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {company.industry} · {company.region}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">

          {/* Company meta */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Building2, label: company.industry },
              { icon: MapPin,    label: company.region   },
              { icon: Users,     label: company.size     },
              ...(company.foundedYear ? [{ icon: Calendar, label: `Основана в ${company.foundedYear}` }] : []),
              ...(company.website    ? [{ icon: Globe,    label: company.website }] : []),
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {company.description}
          </p>

          {/* Signals */}
          {company.signals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Почему интересна
              </p>
              <div className="space-y-1.5">
                {company.signals.map((s) => (
                  <SignalBadge key={s.label} label={s.label} type={s.type} />
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{company.contact.name}</p>
              <p className="text-xs text-muted-foreground">{company.contact.role}</p>
            </div>
            <div className="space-y-1.5">
              <a
                href={`mailto:${company.contact.email}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {company.contact.email}
              </a>
              <a
                href={`tel:${company.contact.phone}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {company.contact.phone}
              </a>
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex gap-2 px-5 py-4 border-t border-border bg-card/95 backdrop-blur-sm">
          <button
            onClick={() => onWrite(company)}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
              'text-sm font-semibold',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Mail className="h-4 w-4" />
            Написать
          </button>
          <a
            href={`tel:${company.contact.phone}`}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
              'text-sm font-semibold',
              'border border-border bg-card text-foreground',
              'hover:bg-accent transition-colors',
            )}
          >
            <Phone className="h-4 w-4" />
            Позвонить
          </a>
          <button
            onClick={() => onSkip(company)}
            className={cn(
              'inline-flex items-center justify-center rounded-lg px-3 py-2.5',
              'text-sm font-medium text-muted-foreground',
              'border border-border bg-card',
              'hover:text-foreground hover:bg-accent transition-colors',
            )}
            title="Пропустить"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  )
}
