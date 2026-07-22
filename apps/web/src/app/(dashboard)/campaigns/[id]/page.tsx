'use client'

import { useState, useEffect, use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Mail, Clock, Play, Pause, Square, Save, Users, Search,
  Sparkles, ArrowUp, ArrowDown,
} from 'lucide-react'
import { api, type Company, type Sequence, type SequenceStep, type CreateSequenceBody } from '@/lib/api-client'
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

// ─── Enrollment status ────────────────────────────────────────────────────────

const ENR_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  paused: 'text-yellow-400',
  completed: 'text-blue-400',
  replied: 'text-purple-400',
  bounced: 'text-red-400',
  stopped: 'text-gray-400',
  unsubscribed: 'text-gray-400',
}

const ENR_LABELS: Record<string, string> = {
  active: 'Активен',
  paused: 'На паузе',
  completed: 'Завершён',
  replied: 'Ответил',
  bounced: 'Отскок',
  stopped: 'Остановлен',
  unsubscribed: 'Отписался',
}

// ─── Reply classification labels ──────────────────────────────────────────────

const REPLY_LABELS: Record<string, string> = {
  interested: '🟢 Интерес',
  not_now: '🟡 Не сейчас',
  not_interested: '🔴 Не интересно',
  out_of_office: '📭 Автоответ',
  question: '❓ Вопрос',
  other: 'Ответил',
}

// ─── AI Generate Preview Dialog ───────────────────────────────────────────────

function AiPreviewDialog({
  sequenceId,
  stepNumber,
  onClose,
}: {
  sequenceId: string
  stepNumber: number
  onClose: () => void
}) {
  const [companySearch, setCompanySearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    subject: string; bodyText: string; bodyHtml: string; usedAI: boolean; companyName: string
  } | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(companySearch), 300)
    return () => clearTimeout(t)
  }, [companySearch])

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-preview', debouncedSearch],
    queryFn: () => api.companies.list({ ...(debouncedSearch ? { search: debouncedSearch } : {}), limit: 10, page: 1 }),
  })

  const companiesList: Company[] = companiesData?.data ?? []

  async function handleGenerate() {
    if (!selectedCompanyId) return
    setGenerating(true)
    try {
      const result = await api.sequences.generatePreview(sequenceId, {
        stepNumber,
        companyId: selectedCompanyId,
      })
      setPreview(result.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка генерации')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">AI предпросмотр письма</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Выберите компанию для персонализации шага {stepNumber}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Company selector */}
          {!preview ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Поиск компании..."
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                {companiesLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Загрузка...</div>
                ) : companiesList.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Компании не найдены</div>
                ) : (
                  <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {companiesList.map((company) => (
                      <label key={company.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          name="preview-company"
                          value={company.id}
                          checked={selectedCompanyId === company.id}
                          onChange={() => setSelectedCompanyId(company.id)}
                          className="text-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[company.city, company.industry].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => void handleGenerate()}
                disabled={!selectedCompanyId || generating}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Генерация...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Сгенерировать с AI
                  </>
                )}
              </button>
            </>
          ) : (
            /* Preview result */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {preview.usedAI ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      <Sparkles className="h-3 w-3" /> AI персонализировал
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Шаблон (нет ключа OpenAI)</span>
                  )}
                  <span className="text-xs text-muted-foreground">для {preview.companyName}</span>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Другая компания
                </button>
              </div>

              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Тема</label>
                  <p className="mt-1 text-sm font-medium text-foreground">{preview.subject}</p>
                </div>
                <div className="border-t border-border pt-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Тело письма</label>
                  <div
                    className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                  />
                </div>
              </div>

              {preview.usedAI && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ AI генерирует уникальную версию для каждого получателя при отправке. Этот предпросмотр показывает один из вариантов.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  totalSteps,
  sequenceId,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  step: SequenceStep
  index: number
  totalSteps: number
  sequenceId: string
  onUpdate: (s: SequenceStep) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [expanded, setExpanded] = useState(index === 0)
  const [showAiPreview, setShowAiPreview] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Step number */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {step.stepNumber}
        </div>

        {/* Step type label */}
        <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0 flex-1">
          {step.type === 'email' ? (
            <><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Email</>
          ) : (
            <><Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Ожидание</>
          )}
          {step.type === 'email' && step.subject && (
            <span className="text-muted-foreground font-normal truncate text-xs">
              — {step.subject}
            </span>
          )}
          {step.type === 'wait' && (
            <span className="text-muted-foreground font-normal text-xs">
              — {step.delayDays ?? 0}д {step.delayHours ?? 0}ч
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          {/* AI preview — only for email steps */}
          {step.type === 'email' && (
            <button
              onClick={() => setShowAiPreview(true)}
              title="Предпросмотр с AI"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Reorder */}
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            title="Переместить вверх"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            title="Переместить вниз"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {/* Delete */}
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
                  Используйте {'{{name}}'}, {'{{city}}'}, {'{{industry}}'} — AI заменит их при отправке
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Текст письма
                </label>
                <textarea
                  rows={8}
                  value={step.bodyText ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...step,
                      bodyText: e.target.value,
                      bodyHtml: `<p>${e.target.value.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
                    })
                  }
                  placeholder={"Здравствуйте,\n\nМеня зовут [Ваше имя]. Пишу вам потому что..."}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step.stopOnReply ?? true}
                    onChange={(e) => onUpdate({ ...step, stopOnReply: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-foreground">Остановить при ответе</span>
                </label>
                <button
                  onClick={() => setShowAiPreview(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Предпросмотр с AI
                </button>
              </div>
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

      {/* AI Preview dialog */}
      {showAiPreview && (
        <AiPreviewDialog
          sequenceId={sequenceId}
          stepNumber={step.stepNumber}
          onClose={() => setShowAiPreview(false)}
        />
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
      ? [...sequence.steps].sort((a, b) => a.stepNumber - b.stepNumber)
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

  function moveStep(i: number, direction: 'up' | 'down') {
    if (direction === 'up' && i === 0) return
    if (direction === 'down' && i === steps.length - 1) return
    const next = [...steps]
    const swapWith = direction === 'up' ? i - 1 : i + 1
    ;[next[i], next[swapWith]] = [next[swapWith]!, next[i]!]
    // Re-number after swap
    setSteps(next.map((s, idx) => ({ ...s, stepNumber: idx + 1 })))
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

      {/* AI hint */}
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Используйте {'{{name}}'}, {'{{city}}'}, {'{{industry}}'} в шаблонах — AI персонализирует каждое письмо перед отправкой.
          Нажмите <Sparkles className="h-3 w-3 inline text-primary" /> для предпросмотра.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <StepCard
            key={`${step.stepNumber}-${step.type}-${i}`}
            step={step}
            index={i}
            totalSteps={steps.length}
            sequenceId={sequence.id}
            onUpdate={(s) => updateStep(i, s)}
            onDelete={() => deleteStep(i)}
            onMoveUp={() => moveStep(i, 'up')}
            onMoveDown={() => moveStep(i, 'down')}
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
          onKeyDown={(e) =>
            e.key === 'Enter' &&
            name.trim() &&
            mutation.mutate({ name: name.trim(), campaignId, steps: [] })
          }
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
          >
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

// ─── Enroll modal ─────────────────────────────────────────────────────────────

function EnrollModal({
  campaignId,
  sequences,
  onClose,
}: {
  campaignId: string
  sequences: Sequence[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [sequenceId, setSequenceId] = useState(sequences[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-enroll', debouncedSearch],
    queryFn: () =>
      api.companies.list({ ...(debouncedSearch ? { search: debouncedSearch } : {}), limit: 20, page: 1 }),
  })

  const mutation = useMutation({
    mutationFn: () =>
      api.campaigns.enroll(campaignId, {
        sequenceId,
        companyIds: Array.from(selectedIds),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      void queryClient.invalidateQueries({ queryKey: ['campaign-enrollments', campaignId] })
      const { enrolled, skipped } = result.data
      toast.success(
        skipped > 0
          ? `Зачислено: ${enrolled}, пропущено дубликатов: ${skipped}`
          : `Зачислено: ${enrolled} компаний`,
      )
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const companiesList: Company[] = companiesData?.data ?? []

  const toggleCompany = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => {
    if (companiesList.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(companiesList.map((c) => c.id)))
    }
  }

  const allSelected = companiesList.length > 0 && companiesList.every((c) => selectedIds.has(c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-xl max-h-[85vh]">
        {/* Header */}
        <div className="shrink-0 border-b border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">Зачислить компании</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Выберите цепочку и компании для запуска outreach
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Sequence selector — only if multiple sequences */}
          {sequences.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Цепочка</label>
              <select
                value={sequenceId}
                onChange={(e) => setSequenceId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {sequences.map((seq) => (
                  <option key={seq.id} value={seq.id}>
                    {seq.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Company search */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Компании
              {selectedIds.size > 0 && (
                <span className="ml-2 font-normal text-primary">{selectedIds.size} выбрано</span>
              )}
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию..."
                className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {companiesLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Загрузка...</div>
            ) : companiesList.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Компании не найдены</div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Select all row */}
                <label className="flex items-center gap-3 px-3 py-2.5 border-b border-border cursor-pointer hover:bg-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Выбрать все</span>
                </label>
                <div className="max-h-48 overflow-y-auto">
                  {companiesList.map((company) => (
                    <label
                      key={company.id}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(company.id)}
                        onChange={() => toggleCompany(company.id)}
                        className="rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
                        {(company.city || company.industry) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[company.city, company.industry].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 border-t border-border p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={selectedIds.size === 0 || !sequenceId || mutation.isPending}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {mutation.isPending
              ? 'Зачисление...'
              : selectedIds.size > 0
                ? `Зачислить ${selectedIds.size}`
                : 'Зачислить'}
          </button>
        </div>
      </div>
    </div>
  )
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
  const [showEnroll, setShowEnroll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.campaigns.get(id),
  })

  const { data: enrollData } = useQuery({
    queryKey: ['campaign-enrollments', id],
    queryFn: () => api.campaigns.enrollments(id, { limit: 100 }),
    enabled: tab === 'enrollments',
  })

  const startMutation = useMutation({
    mutationFn: () => api.campaigns.start(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      toast.success('Кампания запущена')
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const pauseMutation = useMutation({
    mutationFn: () => api.campaigns.pause(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      toast.success('Кампания приостановлена')
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const stopMutation = useMutation({
    mutationFn: () => api.campaigns.stop(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      toast.success('Кампания остановлена')
      setConfirmStop(false)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setConfirmStop(false)
    },
  })
  const deleteSeqMutation = useMutation({
    mutationFn: (seqId: string) => api.sequences.delete(seqId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      toast.success('Цепочка удалена')
      setConfirmDeleteSeqId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setConfirmDeleteSeqId(null)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!data) return null

  const campaign = data.data
  const sequences = campaign.sequences ?? []
  const stats = campaign.stats as {
    enrolled: number
    sent: number
    opened: number
    clicked: number
    replied: number
    meetings: number
  }

  const canEnroll =
    campaign.status !== 'completed' &&
    campaign.status !== 'archived' &&
    sequences.length > 0

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Рассылки
      </Link>

      {/* Campaign header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  STATUS_COLORS[campaign.status] ?? 'bg-gray-500/20 text-gray-400',
                )}
              >
                {STATUS_LABELS[campaign.status] ?? campaign.status}
              </span>
            </div>
            {campaign.vertical && (
              <p className="mt-0.5 text-sm text-muted-foreground">Вертикаль: {campaign.vertical}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {(campaign.status === 'draft' || campaign.status === 'paused') && (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-900/40 border border-emerald-800/50 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {campaign.status === 'paused' ? 'Возобновить' : 'Запустить'}
              </button>
            )}
            {campaign.status === 'active' && (
              <button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-yellow-900/40 border border-yellow-800/50 px-3 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-900/60 transition-colors disabled:opacity-50"
              >
                <Pause className="h-3.5 w-3.5" /> Пауза
              </button>
            )}
            {(campaign.status === 'active' || campaign.status === 'paused') && (
              <button
                onClick={() => setConfirmStop(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                <Square className="h-3.5 w-3.5" /> Остановить
              </button>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Зачислено', value: stats.enrolled },
            { label: 'Отправлено', value: stats.sent },
            { label: 'Открыто', value: stats.opened },
            { label: 'Нажато', value: stats.clicked },
            { label: 'Ответило', value: stats.replied },
            { label: 'Встречи', value: stats.meetings },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {[
          { value: 'sequences' as const, label: 'Письма', count: sequences.length },
          { value: 'enrollments' as const, label: 'Участники', count: stats.enrolled },
        ].map(({ value, label, count }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === value
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-foreground hover:bg-accent',
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
              <Plus className="h-4 w-4" /> Добавить письмо
            </button>
          </div>

          {sequences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">Письма ещё не добавлены</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Добавьте шаги рассылки — AI подготовит черновик первого письма
              </p>
              <button
                onClick={() => setShowCreateSeq(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> Добавить письмо
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
                            {seq.steps.length > 0 &&
                              ` · ${seq.steps.filter((s) => s.type === 'email').length} письм${
                                seq.steps.filter((s) => s.type === 'email').length === 1
                                  ? 'о'
                                  : seq.steps.filter((s) => s.type === 'email').length < 5
                                    ? 'а'
                                    : ''
                              }`}
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
                          {[...seq.steps]
                            .sort((a, b) => a.stepNumber - b.stepNumber)
                            .map((step) => (
                            <div
                              key={step.stepNumber}
                              title={
                                step.type === 'email'
                                  ? step.subject ?? 'Email'
                                  : `Ожидание ${step.delayDays ?? 0}д`
                              }
                              className={cn(
                                'flex h-7 items-center gap-1 rounded-md px-2 text-xs',
                                step.type === 'email'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {step.type === 'email' ? (
                                <Mail className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
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
        <div className="space-y-4">
          {/* Enroll button */}
          {canEnroll && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowEnroll(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Users className="h-4 w-4" /> Зачислить компании
              </button>
            </div>
          )}

          {!enrollData ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Загрузка участников...
            </div>
          ) : enrollData.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">Нет участников</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Зачислите компании в цепочку, чтобы начать outreach
              </p>
              {canEnroll && (
                <button
                  onClick={() => setShowEnroll(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Users className="h-4 w-4" /> Зачислить компании
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Компания</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Шаг</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Зачислен</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">AI-классификация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollData.data.map((enr) => (
                    <tr key={enr.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        {enr.companyId ? (
                          <Link
                            href={`/companies/${enr.companyId}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {enr.companyName ?? enr.companyId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{enr.contactId ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            ENR_COLORS[enr.status] ?? 'text-muted-foreground',
                          )}
                        >
                          {ENR_LABELS[enr.status] ?? enr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-center">{enr.currentStep}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(enr.enrolledAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {enr.replyClassification
                          ? REPLY_LABELS[enr.replyClassification] ?? enr.replyClassification
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showEnroll && (
            <EnrollModal
              campaignId={id}
              sequences={sequences}
              onClose={() => setShowEnroll(false)}
            />
          )}
        </div>
      )}

      {/* Confirm stop dialog */}
      <ConfirmDialog
        open={confirmStop}
        title="Остановить кампанию?"
        description="Все активные цепочки будут остановлены. Это действие необратимо."
        confirmLabel="Остановить"
        variant="destructive"
        isPending={stopMutation.isPending}
        onConfirm={() => stopMutation.mutate()}
        onCancel={() => setConfirmStop(false)}
      />
    </div>
  )
}
