'use client'

import { useQuery } from '@tanstack/react-query'
import { api, type Campaign } from '@/lib/api-client'
import {
  Building2, Sparkles, Mail, MessageSquare, ArrowRight, CheckCircle2,
  Plus, Zap, ChevronRight, Target,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
  isLoading,
  isError,
}: {
  title: string
  value: number | string | null
  description: string
  icon: React.ElementType
  accent?: string
  isLoading: boolean
  isError: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ?? 'bg-muted')}>
          <Icon className="h-4 w-4 text-foreground/60" />
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      ) : isError ? (
        <p className="text-2xl font-bold text-destructive">—</p>
      ) : (
        <p className="text-2xl font-bold text-foreground">
          {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

// ─── Onboarding checklist ────────────────────────────────────────────────────

interface OnboardingStep {
  key: string
  done: boolean
  title: string
  description: string
  href: string
  cta: string
}

function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
  const progress = Math.round((doneCount / steps.length) * 100)

  if (allDone) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Запуск продукта</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {doneCount} из {steps.length} шагов выполнено
            </p>
          </div>
          <span className="text-xs font-medium text-primary">{progress}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div
            key={step.key}
            className={cn(
              'flex items-center gap-4 px-6 py-3.5 transition-colors',
              step.done ? 'opacity-60' : 'hover:bg-muted/20',
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                step.done
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  step.done ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                {step.cta} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { href: '/companies', icon: Plus, label: 'Добавить компании', sub: 'Импорт или поиск' },
        { href: '/campaigns', icon: Mail, label: 'Новая кампания', sub: 'Настроить outreach' },
        { href: '/companies', icon: Zap, label: 'Найти лиды', sub: '2ГИС и HH.ru' },
        { href: '/analytics', icon: Target, label: 'Аналитика', sub: 'Воронка и метрики' },
      ].map(({ href, icon: Icon, label, sub }) => (
        <Link
          key={href + label}
          href={href}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 hover:bg-accent hover:border-primary/30 transition-all group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground leading-snug">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Recent campaigns mini-list ───────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активна',
  paused: 'Пауза',
  completed: 'Завершена',
  archived: 'Архив',
}
const STATUS_DOT: Record<string, string> = {
  draft: 'bg-slate-400',
  active: 'bg-emerald-400',
  paused: 'bg-yellow-400',
  completed: 'bg-blue-400',
  archived: 'bg-gray-500',
}

function RecentCampaigns({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Последние кампании</h2>
        <Link
          href="/campaigns"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Все кампании <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {campaigns.slice(0, 4).map((c) => (
          <Link
            key={c.id}
            href={`/campaigns/${c.id}`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
          >
            <div className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[c.status] ?? 'bg-gray-400')} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABELS[c.status] ?? c.status}
                {c.stats.enrolled > 0 && ` · ${c.stats.enrolled} компаний`}
                {c.stats.sent > 0 && ` · ${c.stats.sent} писем`}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-right">
              {c.stats.replied > 0 && (
                <div>
                  <p className="text-sm font-bold text-emerald-400">{c.stats.replied}</p>
                  <p className="text-[10px] text-muted-foreground">ответов</p>
                </div>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading, isError } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => api.workspace.stats(),
    staleTime: 30_000,
  })

  const { data: emailAccountsData } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => api.emailAccounts.list(),
    staleTime: 60_000,
  })

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', ''],
    queryFn: () => api.campaigns.list({ page: 1, limit: 10 }),
    staleTime: 30_000,
  })

  const stats = statsData?.data
  const campaigns = campaignsData?.data ?? []
  const hasEmailAccounts = (emailAccountsData?.data?.length ?? 0) > 0
  const hasCompanies = !statsLoading && !isError && (stats?.totalCompanies ?? 0) > 0
  const hasEnriched = !statsLoading && !isError && (stats?.enrichedCompanies ?? 0) > 0
  const hasCampaigns = campaigns.length > 0
  const hasOutreach = !statsLoading && !isError && (stats?.emailsSent30d ?? 0) > 0

  const onboardingSteps: OnboardingStep[] = [
    {
      key: 'email',
      done: hasEmailAccounts,
      title: 'Подключите email аккаунт',
      description: 'Mailgun, Brevo или SMTP для отправки писем',
      href: '/settings',
      cta: 'Настройки',
    },
    {
      key: 'companies',
      done: hasCompanies,
      title: 'Добавьте компании',
      description: 'Импорт CSV, поиск через 2ГИС / HH.ru или вручную',
      href: '/companies',
      cta: 'Компании',
    },
    {
      key: 'enrich',
      done: hasEnriched,
      title: 'Обогатите данные',
      description: 'Найдите контакты и email для компаний',
      href: '/companies',
      cta: 'Обогатить',
    },
    {
      key: 'campaign',
      done: hasCampaigns,
      title: 'Создайте кампанию',
      description: 'Настройте outreach-последовательность',
      href: '/campaigns',
      cta: 'Кампании',
    },
    {
      key: 'outreach',
      done: hasOutreach,
      title: 'Запустите рассылку',
      description: 'Запустите кампанию и начните получать ответы',
      href: '/campaigns',
      cta: 'Запустить',
    },
  ]

  const isLoading = statsLoading || campaignsLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Дашборд</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Обзор вашей sales pipeline</p>
        </div>
        <Link
          href="/companies"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Добавить компании
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Компании"
          value={isLoading ? null : (stats?.totalCompanies ?? 0)}
          description="Всего в базе"
          icon={Building2}
          accent="bg-blue-500/10"
          isLoading={isLoading}
          isError={isError}
        />
        <StatCard
          title="Обогащено"
          value={isLoading ? null : (stats?.enrichedCompanies ?? 0)}
          description={
            !isLoading && stats && stats.totalCompanies > 0
              ? `${Math.round((stats.enrichedCompanies / stats.totalCompanies) * 100)}% базы`
              : 'Готовы к рассылке'
          }
          icon={Sparkles}
          accent="bg-cyan-500/10"
          isLoading={isLoading}
          isError={isError}
        />
        <StatCard
          title="Писем отправлено"
          value={isLoading ? null : (stats?.emailsSent30d ?? 0)}
          description="За последние 30 дней"
          icon={Mail}
          accent="bg-violet-500/10"
          isLoading={isLoading}
          isError={isError}
        />
        <StatCard
          title="Ответов"
          value={isLoading ? null : (stats?.repliesCount ?? 0)}
          description={
            !isLoading && stats
              ? `Reply rate: ${stats.replyRate}%`
              : 'Конверсия'
          }
          icon={MessageSquare}
          accent="bg-emerald-500/10"
          isLoading={isLoading}
          isError={isError}
        />
      </div>

      {/* Onboarding checklist */}
      {!isLoading && !isError && (
        <OnboardingChecklist steps={onboardingSteps} />
      )}

      {/* Quick actions — always shown */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Быстрые действия
        </h2>
        <QuickActions />
      </div>

      {/* Recent campaigns */}
      {!campaignsLoading && campaigns.length > 0 && (
        <RecentCampaigns campaigns={campaigns} />
      )}

      {/* Empty state for campaigns */}
      {!isLoading && campaigns.length === 0 && hasCompanies && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Нет активных кампаний</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Компании добавлены — создайте первую outreach-кампанию
          </p>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Создать кампанию
          </Link>
        </div>
      )}
    </div>
  )
}
