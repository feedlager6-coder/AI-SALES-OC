'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Building2, Sparkles, Mail, MessageSquare } from 'lucide-react'

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => api.workspace.stats(),
    staleTime: 30 * 1000, // 30 seconds
  })

  const stats = data?.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Дашборд</h1>
        <p className="text-muted-foreground">Обзор вашей sales pipeline</p>
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
          description="Готовы к outreach"
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
          description={`Reply rate: ${stats?.replyRate ?? 0}%`}
          icon={MessageSquare}
          isError={isError}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Начните с импорта компаний или запуска поиска через 2ГИС / HH.ru
        </p>
      </div>
    </div>
  )
}

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
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      {value === null ? (
        // Loading skeleton
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
