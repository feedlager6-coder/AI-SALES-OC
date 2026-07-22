'use client'

import { useState } from 'react'
import {
  Building2, MapPin, Users, Zap, TrendingUp, Star, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockCompany, SearchResult, SignalType } from '@/lib/search/types'
import { CompanyCard } from './company-card'
import { DraftMessageScreen } from '@/components/draft/draft-message-screen'

// ─── Signal icon (compact) ────────────────────────────────────────────────────

const SIGNAL_ICONS: Record<SignalType, { icon: React.ElementType; color: string }> = {
  hiring:    { icon: Zap,        color: 'text-amber-400'   },
  growing:   { icon: TrendingUp, color: 'text-emerald-400' },
  expanding: { icon: MapPin,     color: 'text-blue-400'    },
  contract:  { icon: Star,       color: 'text-violet-400'  },
}

// ─── Company row card ─────────────────────────────────────────────────────────

function CompanyRow({
  company,
  onClick,
}: {
  company: MockCompany
  onClick: () => void
}) {
  const primarySignal = company.signals[0]
  const SignalIcon = primarySignal ? SIGNAL_ICONS[primarySignal.type] : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-border bg-card p-4',
        'hover:border-primary/30 hover:bg-accent/40',
        'transition-all duration-150 group',
        'flex items-start gap-4',
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm group-hover:bg-primary/20 transition-colors">
        {company.name[0]}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                {company.industry}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {company.region}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                {company.size}
              </span>
            </div>
          </div>
        </div>

        {/* Primary signal */}
        {primarySignal && SignalIcon && (
          <div className="flex items-center gap-1.5 mt-2">
            <SignalIcon.icon className={cn('h-3 w-3 shrink-0', SignalIcon.color)} />
            <span className="text-xs text-muted-foreground">{primarySignal.label}</span>
          </div>
        )}
      </div>

      {/* Contact preview */}
      <div className="shrink-0 hidden sm:flex flex-col items-end gap-1 text-right">
        <p className="text-xs font-medium text-foreground">{company.contact.name}</p>
        <p className="text-xs text-muted-foreground">{company.contact.role}</p>
      </div>
    </button>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SearchResultsProps {
  result: SearchResult
  onNewSearch: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchResults({ result, onNewSearch }: SearchResultsProps) {
  const [selectedCompany, setSelectedCompany] = useState<MockCompany | null>(null)
  const [skippedIds, setSkippedIds]           = useState<Set<string>>(new Set())
  const [writeTarget, setWriteTarget]         = useState<MockCompany | null>(null)

  const visibleCompanies = result.companies.filter((c) => !skippedIds.has(c.id))

  const handleSkip = (company: MockCompany) => {
    setSkippedIds((prev) => new Set(prev).add(company.id))
    setSelectedCompany(null)
  }

  const handleWrite = (company: MockCompany) => {
    setSelectedCompany(null)
    setWriteTarget(company)
  }

  // ── Draft screen takes over the whole results area ──────────────────────────
  if (writeTarget) {
    return (
      <DraftMessageScreen
        company={writeTarget}
        onBack={() => setWriteTarget(null)}
      />
    )
  }

  // ── Results list ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Найдено компаний: {visibleCompanies.length}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
            По запросу «{result.query.rawQuery}»
          </p>
        </div>
        <button
          type="button"
          onClick={onNewSearch}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2',
            'text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent',
            'transition-colors shrink-0',
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Новый поиск
        </button>
      </div>

      {/* Company list */}
      {visibleCompanies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
          <p className="text-sm text-muted-foreground">Все компании пропущены</p>
          <button
            type="button"
            onClick={onNewSearch}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Новый поиск
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleCompanies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              onClick={() => setSelectedCompany(company)}
            />
          ))}
        </div>
      )}

      {/* Company detail modal */}
      {selectedCompany && (
        <CompanyCard
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onWrite={handleWrite}
          onSkip={handleSkip}
        />
      )}

    </div>
  )
}
