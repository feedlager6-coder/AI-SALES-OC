'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Building2, Sparkles, Mail, MessageSquare, ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ─── Onboarding checklist (shown only when workspace is empty) ────────────────

function OnboardingGuide({ hasEmailAccounts }: { hasEmailAccounts: boolean }) {
  const steps = [
    {
      number: 1,
      done: hasEmailAccounts,
      title: 'Добавьте email аккаунт',
      description: 'Подключите Mailgun или SMTP для отправки писем',
      href: '/settings',
      cta: 'Настройки →',
    },
    {
      number: 2,
      done: false,
      title: 'Импортируйте компании',
      description: 'Загрузите CSV, найдите через 2ГИС или HH.ru, или добавьте вручную',
      href: '/companies',
      cta: 'Компании →',
    },
    {
      number: 3,
      done: false,
      title: 'Создайте кампанию',
      description: 'Настройте outreach-последовательность и запустите рассылку',
      href: '/campaigns',
      cta: 'Кампании →',
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">С чего начать</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Выполните три шага, чтобы запустить первую outreach-кампанию
        </p>
      </div>
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div key={step.number} className="flex items-center gap-4 px-6 py-4">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              step.done
                ? 'bg-emerald-900/50 text-emerald-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.number}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
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

// ─── Next step hint (shown when companies exist but no outreach yet) ──────────

function NextStepHint() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Готовы к запуску</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Компании добавлены. Создайте кампанию и начните outreach
        </p>
      </div>
      <Link
        href="/campaigns"
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Создать кампанию <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  isError,
}: {
  title: string
  value: number | null
  description: string
  icon: React.ElementType
  isError: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      {value === null ? (
        <div className="mt-2 h-9 w-16 animate-pulse rounded bg-muted" />
      ) : isError ? (
        <p className="mt-2 text-3xl font-bold text-destructive">—</p>
      ) : (
        <p className="mt-2 text-3xl font-bold text-foreground">
          {value.toLocaleString('ru-RU')}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => api.workspace.stats(),
    staleTime: 30_000,
  })

  const { data: emailAccountsData } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => api.emailAccounts.list(),
    staleTime: 60_000,
  })

  const stats = data?.data
  const hasCompanies = !isLoading && !isError && (stats?.totalCompanies ?? 0) > 0
  const hasOutreach = !isLoading && !isError && (stats?.emailsSent30d ?? 0) > 0
  const hasEmailAccounts = (emailAccountsData?.data?.length ?? 0) > 0

  const showOnboarding = !isLoading && !isError && !hasCompanies
  const showNextStep = !isLoading && !isError && hasCompanies && !hasOutreach

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Дашборд</h1>
        <p className="text-muted-foreground text-sm mt-1">Обзор вашей sales pipeline</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Компании"
          value={isLoading ? null : (stats?.totalCompanies ?? 0)}
          description="Всего в базе"
          icon={Building2}
          isError={isError}
        />
        <StatCard
          title="Обогащено"
          value={isLoading ? null : (stats?.enrichedCompanies ?? 0)}
          description="Готовы к рассылке"
          icon={Sparkles}
          isError={isError}
        />
        <StatCard
          title="Отправлено писем"
          value={isLoading ? null : (stats?.emailsSent30d ?? 0)}
          description="За последние 30 дней"
          icon={Mail}
          isError={isError}
        />
        <StatCard
          title="Ответов"
          value={isLoading ? null : (stats?.repliesCount ?? 0)}
          description={`Конверсия: ${stats?.replyRate ?? 0}%`}
          icon={MessageSquare}
          isError={isError}
        />
      </div>

      {showOnboarding && <OnboardingGuide hasEmailAccounts={hasEmailAccounts} />}
      {showNextStep && <NextStepHint />}
    </div>
  )
}
