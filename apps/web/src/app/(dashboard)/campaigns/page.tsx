'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Play, Pause, Square, Mail, ChevronRight,
} from 'lucide-react'
import { api, type Campaign, type CreateCampaignBody } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активна',
  paused: 'Пауза',
  completed: 'Завершена',
  archived: 'Архив',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Create campaign modal ────────────────────────────────────────────────────

function CreateCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [dailyLimit, setDailyLimit] = useState(50)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: CreateCampaignBody) => api.campaigns.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Кампания создана')
      onClose()
      setName('')
      setDailyLimit(50)
    },
    onError: (err: Error) => {
      setError(err.message)
      toast.error(err.message)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="border-b border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">Новая кампания</h2>
          <p className="mt-1 text-sm text-muted-foreground">Создайте outreach-кампанию</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) { setError('Введите название кампании'); return }
            setError(null)
            mutation.mutate({
              name: name.trim(),
              sendingSettings: {
                days: [1, 2, 3, 4, 5],
                time_from: '09:00',
                time_to: '18:00',
                timezone: 'Europe/Moscow',
                daily_limit: dailyLimit,
              },
            })
          }}
          className="space-y-4 p-5"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Название кампании
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Логистика МСК — Q3 2026"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Дневной лимит писем
            </label>
            <input
              type="number"
              min={1}
              max={2000}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">Рекомендуется: 30–100 для нового домена</p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: () => api.campaigns.start(campaign.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Кампания запущена') },
    onError: (err: Error) => toast.error(err.message),
  })

  const pauseMutation = useMutation({
    mutationFn: () => api.campaigns.pause(campaign.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Кампания приостановлена') },
    onError: (err: Error) => toast.error(err.message),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.campaigns.stop(campaign.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Кампания остановлена') },
    onError: (err: Error) => toast.error(err.message),
  })

  const stats = campaign.stats

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="truncate text-base font-semibold text-foreground">{campaign.name}</h3>
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.vertical && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Вертикаль: {campaign.vertical}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {campaign.status === 'draft' || campaign.status === 'paused' ? (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              title="Запустить"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {campaign.status === 'active' ? (
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              title="Пауза"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-yellow-600 hover:bg-yellow-50 transition-colors disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {campaign.status === 'active' || campaign.status === 'paused' ? (
            <button
              onClick={() => {
                if (confirm('Остановить кампанию? Отправка будет завершена.')) {
                  stopMutation.mutate()
                }
              }}
              disabled={stopMutation.isPending}
              title="Остановить"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <Link
            href={`/campaigns/${campaign.id}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
            title="Подробнее"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-5 gap-2 border-t border-border pt-4">
        {[
          { label: 'Зачислено', value: stats.enrolled },
          { label: 'Отправлено', value: stats.sent },
          { label: 'Открыто', value: stats.opened },
          { label: 'Ответило', value: stats.replied },
          { label: 'Встречи', value: stats.meetings },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sending settings */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>📅 Пн–Пт</span>
        <span>🕘 {campaign.sendingSettings.time_from}–{campaign.sendingSettings.time_to}</span>
        <span>📧 до {campaign.sendingSettings.daily_limit}/день</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns', statusFilter],
    queryFn: () =>
      api.campaigns.list({ page: 1, limit: 50, ...(statusFilter ? { status: statusFilter } : {}) }),
  })

  const campaigns = data?.data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Кампании</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Email-кампании и outreach-последовательности
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Новая кампания
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { value: '', label: 'Все' },
          { value: 'active', label: 'Активные' },
          { value: 'draft', label: 'Черновики' },
          { value: 'paused', label: 'На паузе' },
          { value: 'completed', label: 'Завершённые' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              statusFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-foreground hover:bg-accent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-destructive text-sm">Ошибка загрузки кампаний</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/50 mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-1">Нет кампаний</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Создайте первую кампанию, чтобы начать outreach
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Создать кампанию
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      <CreateCampaignModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
