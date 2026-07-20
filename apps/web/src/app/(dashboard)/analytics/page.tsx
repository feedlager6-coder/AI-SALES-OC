'use client'

import { useQuery } from '@tanstack/react-query'
import { api, type Campaign } from '@/lib/api-client'
import {
  Building2, Sparkles, Mail, MessageSquare,
  TrendingUp, Target, BarChart3,
} from 'lucide-react'
import Link from 'next/link'

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading,
  accent,
}: {
  title: string
  value: string | number | null
  subtitle: string
  icon: React.ElementType
  isLoading: boolean
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ?? 'bg-primary/10'}`}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <p className="text-3xl font-bold text-foreground">
          {value ?? '—'}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function FunnelBar({
  label,
  value,
  total,
  color,
  isLoading,
}: {
  label: string
  value: number
  total: number
  color: string
  isLoading: boolean
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <span className="text-foreground font-bold">{value.toLocaleString('ru-RU')}</span>
              {total > 0 && (
                <span className="text-xs text-muted-foreground">({pct}%)</span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        {isLoading ? (
          <div className="h-full w-1/2 animate-pulse rounded-full bg-muted-foreground/20" />
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => api.workspace.stats(),
    staleTime: 60_000,
  })

  const stats = data?.data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Аналитика</h1>
        <p className="text-sm text-muted-foreground mt-1">Метрики и эффективность outreach</p>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive">
            Ошибка загрузки данных. Проверьте подключение и обновите страницу.
          </p>
        </div>
      )}

      {/* Key metrics */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Ключевые показатели</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Компании в базе"
            value={stats?.totalCompanies?.toLocaleString('ru-RU') ?? null}
            subtitle="Всего добавлено"
            icon={Building2}
            isLoading={isLoading}
          />
          <MetricCard
            title="Обогащено"
            value={stats?.enrichedCompanies?.toLocaleString('ru-RU') ?? null}
            subtitle="Готовы к рассылке"
            icon={Sparkles}
            isLoading={isLoading}
            accent="bg-cyan-500/10"
          />
          <MetricCard
            title="Отправлено писем"
            value={stats?.emailsSent30d?.toLocaleString('ru-RU') ?? null}
            subtitle="За последние 30 дней"
            icon={Mail}
            isLoading={isLoading}
            accent="bg-violet-500/10"
          />
          <MetricCard
            title="Ответов получено"
            value={stats?.repliesCount?.toLocaleString('ru-RU') ?? null}
            subtitle={`Конверсия: ${stats?.replyRate ?? 0}%`}
            icon={MessageSquare}
            isLoading={isLoading}
            accent="bg-emerald-500/10"
          />
        </div>
      </section>

      {/* Conversion funnel */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Воронка конверсии</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <FunnelBar
            label="Компании в базе"
            value={stats?.totalCompanies ?? 0}
            total={stats?.totalCompanies ?? 0}
            color="bg-primary"
            isLoading={isLoading}
          />
          <FunnelBar
            label="Обогащены"
            value={stats?.enrichedCompanies ?? 0}
            total={stats?.totalCompanies ?? 0}
            color="bg-cyan-500"
            isLoading={isLoading}
          />
          <FunnelBar
            label="Получили письмо"
            value={stats?.emailsSent30d ?? 0}
            total={stats?.totalCompanies ?? 0}
            color="bg-violet-500"
            isLoading={isLoading}
          />
          <FunnelBar
            label="Ответили"
            value={stats?.repliesCount ?? 0}
            total={stats?.emailsSent30d ?? 0}
            color="bg-emerald-500"
            isLoading={isLoading}
          />

          {!isLoading && stats?.totalCompanies === 0 && (
            <p className="text-center text-sm text-muted-foreground pt-2">
              Начните с импорта компаний, чтобы увидеть данные воронки
            </p>
          )}
        </div>
      </section>

      {/* Reply rate */}
      {!isLoading && stats && stats.emailsSent30d > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Эффективность</h2>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Reply Rate (30 дней)</p>
              <p className="text-2xl font-bold text-foreground">{stats.replyRate}%</p>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  stats.replyRate >= 10
                    ? 'bg-emerald-500'
                    : stats.replyRate >= 5
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(stats.replyRate * 5, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>0%</span>
              <span className="text-yellow-500">5% — хорошо</span>
              <span className="text-emerald-500">10% — отлично</span>
              <span>20%+</span>
            </div>
          </div>
        </section>
      )}

      {/* Per-campaign breakdown */}
      <CampaignBreakdown />

      {/* Coming soon */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Детальные отчёты</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Динамика отправок', desc: 'График отправок по дням и неделям' },
            { title: 'Анализ открытий', desc: 'Время и частота открытия писем' },
            { title: 'Эффективность по отраслям', desc: 'Reply rate в разрезе отраслей' },
            { title: 'Лучшие темы писем', desc: 'Тема с наивысшим open rate' },
            { title: 'География лидов', desc: 'Распределение компаний по регионам' },
            { title: 'AI-персонализация', desc: 'Эффект AI vs шаблон на reply rate' },
          ].map(({ title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-dashed border-border bg-card/50 p-5 flex flex-col gap-2"
            >
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <span className="mt-auto inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground w-fit">
                Скоро
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── Per-campaign breakdown ────────────────────────────────────────────────────

const CAMP_STATUS: Record<string, string> = {
  draft: 'Черновик', active: 'Активна', paused: 'Пауза',
  completed: 'Завершена', archived: 'Архив',
}
const CAMP_COLOR: Record<string, string> = {
  draft: 'text-slate-400',
  active: 'text-emerald-400',
  paused: 'text-yellow-400',
  completed: 'text-blue-400',
  archived: 'text-gray-400',
}

function CampaignBreakdown() {
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns-analytics'],
    queryFn: () => api.campaigns.list({ limit: 50 }),
    staleTime: 60_000,
  })

  const campaigns: Campaign[] = data?.data ?? []

  // Only show campaigns that have any activity
  const activeCampaigns = campaigns.filter(
    (c) => c.stats.enrolled > 0 || c.stats.sent > 0,
  )

  if (!isLoading && activeCampaigns.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Кампании</h2>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {['Кампания', 'Статус', 'Зачислено', 'Отправлено', 'Открыто', 'Нажато', 'Ответило'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : activeCampaigns.map((c) => {
                  const openRate =
                    c.stats.sent > 0
                      ? Math.round((c.stats.opened / c.stats.sent) * 100)
                      : 0
                  const replyRate =
                    c.stats.sent > 0
                      ? Math.round((c.stats.replied / c.stats.sent) * 100)
                      : 0
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px]">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="hover:text-primary transition-colors truncate block"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${CAMP_COLOR[c.status] ?? 'text-muted-foreground'}`}>
                          {CAMP_STATUS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">{c.stats.enrolled}</td>
                      <td className="px-4 py-3 text-center text-foreground">{c.stats.sent}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-foreground">{c.stats.opened}</span>
                        {c.stats.sent > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({openRate}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">{c.stats.clicked}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={c.stats.replied > 0 ? 'text-emerald-400 font-medium' : 'text-foreground'}>
                          {c.stats.replied}
                        </span>
                        {c.stats.sent > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({replyRate}%)</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
