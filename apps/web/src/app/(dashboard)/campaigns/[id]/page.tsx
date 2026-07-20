'use client'

import { useState, use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Mail, Clock, Play, Pause, Square, Save, Users,
} from 'lucide-react'
import { api, type Sequence, type SequenceStep, type CreateSequenceBody } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', active: 'Активна', paused: 'Пауза',
  completed: 'Завершена', archived: 'Архив',
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  archived: 'bg-gray-500/20 text-gray-400',
}

// ─── Step editor ──────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
}: {
  step: SequenceStep
  index: number
  onUpdate: (s: SequenceStep) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {step.stepNumber}
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {step.type === 'email' ? (
            <><Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email</>
          ) : (
            <><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Ожидание</>
          )}
          {step.type === 'email' && step.subject && (
            <span className="text-muted-foreground font-normal truncate max-w-[200px]">
              — {step.subject}
            </span>
          )}
          {step.type === 'wait' && (
            <span className="text-muted-foreground font-normal">
              — {step.delayDays ?? 0}д {step.delayHours ?? 0}ч
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {step.type === 'email' ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Тема письма
                </label>
                <input
                  type="text"
                  value={step.subject ?? ''}
                  onChange={(e) => onUpdate({ ...step, subject: e.target.value })}
                  placeholder="Сотрудничество с {{name}}"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Используйте {'{{name}}'}, {'{{city}}'}, {'{{industry}}'} для персонализации
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Текст письма
                </label>
                <textarea
                  rows={8}
                  value={step.bodyText ?? ''}
                  onChange={(e) => onUpdate({ ...step, bodyText: e.target.value, bodyHtml: `<p>${e.target.value.replace(/\n/g, '</p><p>')}</p>` })}
                  placeholder="Здравствуйте,&#10;&#10;Меня зовут [Ваше имя]. Пишу вам потому что..."
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={step.stopOnReply ?? true}
                  onChange={(e) => onUpdate({ ...step, stopOnReply: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Остановить цепочку при ответе</span>
              </label>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Дни ожидания
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={step.delayDays ?? 0}
                  onChange={(e) => onUpdate({ ...step, delayDays: Number(e.target.value) })}
                  className="w-24 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Часы ожидания
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={step.delayHours ?? 0}
                  onChange={(e) => onUpdate({ ...step, delayHours: Number(e.target.value) })}
                  className="w-24 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sequence editor panel ────────────────────────────────────────────────────

function SequenceEditor({
  sequence,
  onClose,
}: {
  sequence: Sequence
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [steps, setSteps] = useState<SequenceStep[]>(
    sequence.steps.length > 0
      ? sequence.steps
      : [{ stepNumber: 1, type: 'email', subject: '', bodyText: '', stopOnReply: true }],
  )

  const saveMutation = useMutation({
    mutationFn: () => api.sequences.update(sequence.id, { steps }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', sequence.campaignId] })
      toast.success('Цепочка сохранена')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function addStep(type: 'email' | 'wait') {
    const next = (steps[steps.length - 1]?.stepNumber ?? 0) + 1
    if (type === 'email') {
      setSteps([...steps, { stepNumber: next, type: 'email', subject: '', bodyText: '', stopOnReply: true }])
    } else {
      setSteps([...steps, { stepNumber: next, type: 'wait', delayDays: 3, delayHours: 0 }])
    }
  }

  function updateStep(i: number, updated: SequenceStep) {
    setSteps(steps.map((s, idx) => (idx === i ? updated : s)))
  }

  function deleteStep(i: number) {
    const updated = steps
      .filter((_, idx) => idx !== i)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }))
    setSteps(updated)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{sequence.name}</h3>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Закрыть
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <StepCard
            key={`${step.stepNumber}-${step.type}`}
            step={step}
            index={i}
            onUpdate={(s) => updateStep(i, s)}
            onDelete={() => deleteStep(i)}
          />
        ))}
      </div>

      {/* Add step buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => addStep('email')}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Mail className="h-3.5 w-3.5" /> + Email
        </button>
        <button
          onClick={() => addStep('wait')}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Clock className="h-3.5 w-3.5" /> + Ожидание
        </button>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2 border-t border-border">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || steps.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? 'Сохранение...' : 'Сохранить цепочку'}
        </button>
      </div>
    </div>
  )
}

// ─── Create sequence modal ────────────────────────────────────────────────────

function CreateSequenceModal({
  campaignId,
  open,
  onClose,
}: {
  campaignId: string
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: (body: CreateSequenceBody) => api.sequences.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      toast.success('Цепочка создана')
      setName('')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Новая цепочка</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Холодный outreach — IT МСК"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && mutation.mutate({ name: name.trim(), campaignId, steps: [] })}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors">
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate({ name: name.trim(), campaignId, steps: [] })}
            disabled={!name.trim() || mutation.isPending}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Enrollment status badge ──────────────────────────────────────────────────

const ENR_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  paused: 'text-yellow-400',
  completed: 'text-blue-400',
  replied: 'text-purple-400',
  bounced: 'text-red-400',
  stopped: 'text-gray-400',
  unsubscribed: 'text-gray-400',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'sequences' | 'enrollments'>('sequences')
  const [showCreateSeq, setShowCreateSeq] = useState(false)
  const [editingSeqId, setEditingSeqId] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmDeleteSeqId, setConfirmDeleteSeqId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.campaigns.get(id),
  })

  const { data: enrollData } = useQuery({
    queryKey: ['campaign-enrollments', id],
    queryFn: () => api.campaigns.enrollments(id, { limit: 50 }),
    enabled: tab === 'enrollments',
  })

  const startMutation = useMutation({
    mutationFn: () => api.campaigns.start(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaign', id] }); toast.success('Кампания запущена') },
    onError: (err: Error) => toast.error(err.message),
  })
  const pauseMutation = useMutation({
    mutationFn: () => api.campaigns.pause(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaign', id] }); toast.success('Кампания приостановлена') },
    onError: (err: Error) => toast.error(err.message),
  })
  const stopMutation = useMutation({
    mutationFn: () => api.campaigns.stop(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaign', id] }); toast.success('Кампания остановлена'); setConfirmStop(false) },
    onError: (err: Error) => { toast.error(err.message); setConfirmStop(false) },
  })

  const deleteSeqMutation = useMutation({
    mutationFn: (seqId: string) => api.sequences.delete(seqId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['campaign', id] }); toast.success('Цепочка удалена'); setConfirmDeleteSeqId(null) },
    onError: (err: Error) => { toast.error(err.message); setConfirmDeleteSeqId(null) },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!data) return null

  const campaign = data.data
  const sequences = campaign.sequences ?? []
  const stats = campaign.stats

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Кампании
      </Link>

      {/* Campaign header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[campaign.status] ?? 'bg-gray-500/20 text-gray-400')}>
                {STATUS_LABELS[campaign.status] ?? campaign.status}
              </span>
            </div>
            {campaign.vertical && <p className="mt-0.5 text-sm text-muted-foreground">Вертикаль: {campaign.vertical}</p>}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {(campaign.status === 'draft' || campaign.status === 'paused') && (
              <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                <Play className="h-3.5 w-3.5" /> Запустить
              </button>
            )}
            {campaign.status === 'active' && (
              <button onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                <Pause className="h-3.5 w-3.5" /> Пауза
              </button>
            )}
            {(campaign.status === 'active' || campaign.status === 'paused') && (
              <button onClick={() => setConfirmStop(true)} disabled={stopMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                <Square className="h-3.5 w-3.5" /> Стоп
              </button>
            )}
            <ConfirmDialog
              open={confirmStop}
              title="Остановить кампанию?"
              description="Отправка писем будет прекращена. Это действие нельзя отменить."
              confirmLabel="Остановить"
              variant="destructive"
              isPending={stopMutation.isPending}
              onConfirm={() => stopMutation.mutate()}
              onCancel={() => setConfirmStop(false)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-5 gap-3 border-t border-border pt-4">
          {[
            { label: 'Зачислено', value: stats.enrolled },
            { label: 'Отправлено', value: stats.sent },
            { label: 'Открыто', value: stats.opened },
            { label: 'Ответило', value: stats.replied },
            { label: 'Встречи', value: stats.meetings },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {[
          { value: 'sequences' as const, label: 'Цепочки', count: sequences.length },
          { value: 'enrollments' as const, label: 'Участники', count: stats.enrolled },
        ].map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === value ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground hover:bg-accent',
            )}
          >
            {label}
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-xs">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Sequences tab */}
      {tab === 'sequences' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateSeq(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Новая цепочка
            </button>
          </div>

          {sequences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">Нет цепочек</h3>
              <p className="text-sm text-muted-foreground mb-4">Создайте email-последовательность для этой кампании</p>
              <button onClick={() => setShowCreateSeq(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" /> Создать цепочку
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sequences.map((seq) => (
                <div key={seq.id}>
                  {editingSeqId === seq.id ? (
                    <SequenceEditor sequence={seq} onClose={() => setEditingSeqId(null)} />
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{seq.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {seq.steps.length} шаг{seq.steps.length === 1 ? '' : seq.steps.length < 5 ? 'а' : 'ов'}
                            {seq.steps.length > 0 && ` · ${seq.steps.filter(s => s.type === 'email').length} письм${seq.steps.filter(s => s.type === 'email').length === 1 ? 'о' : seq.steps.filter(s => s.type === 'email').length < 5 ? 'а' : ''}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingSeqId(seq.id)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => setConfirmDeleteSeqId(seq.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Steps summary */}
                      {seq.steps.length > 0 && (
                        <div className="mt-4 flex items-center gap-1 flex-wrap">
                          {seq.steps.map((step) => (
                            <div
                              key={step.stepNumber}
                              title={step.type === 'email' ? step.subject ?? 'Email' : `Ожидание ${step.delayDays ?? 0}д`}
                              className={cn(
                                'flex h-7 items-center gap-1 rounded-md px-2 text-xs',
                                step.type === 'email'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {step.type === 'email' ? <Mail className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {step.stepNumber}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <CreateSequenceModal
            campaignId={id}
            open={showCreateSeq}
            onClose={() => setShowCreateSeq(false)}
          />
          <ConfirmDialog
            open={confirmDeleteSeqId !== null}
            title="Удалить цепочку?"
            description="Цепочка и все её шаги будут удалены безвозвратно."
            confirmLabel="Удалить"
            variant="destructive"
            isPending={deleteSeqMutation.isPending}
            onConfirm={() => confirmDeleteSeqId && deleteSeqMutation.mutate(confirmDeleteSeqId)}
            onCancel={() => setConfirmDeleteSeqId(null)}
          />
        </div>
      )}

      {/* Enrollments tab */}
      {tab === 'enrollments' && (
        <div>
          {!enrollData ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : enrollData.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">Нет участников</h3>
              <p className="text-sm text-muted-foreground">Зачислите компании в цепочку из раздела Компании</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Участник</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Шаг</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Зачислен</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Ответ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollData.data.map((enr) => (
                    <tr key={enr.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground">{enr.companyId ?? enr.contactId ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium', ENR_COLORS[enr.status] ?? 'text-muted-foreground')}>
                          {enr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{enr.currentStep}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(enr.enrolledAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{enr.replyClassification ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
