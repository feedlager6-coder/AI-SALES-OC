'use client'

import { useState, useCallback } from 'react'
import { Search, X, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import { api, type LeadSearchJobStatus } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface LeadSearchModalProps {
  open: boolean
  onClose: () => void
  onComplete?: (result: LeadSearchJobStatus['result']) => void
}

type Source = '2gis' | 'hhru'

const SOURCE_OPTIONS: Array<{ value: Source; label: string; description: string; icon: string }> = [
  {
    value: '2gis',
    label: '2ГИС',
    description: 'Справочник компаний. Транспорт, логистика, склады.',
    icon: '🗺️',
  },
  {
    value: 'hhru',
    label: 'HH.ru',
    description: 'Работодатели с вакансиями — сигнал роста.',
    icon: '💼',
  },
]

const POPULAR_INDUSTRIES = [
  'Транспорт и логистика',
  'Грузоперевозки',
  'Курьерская доставка',
  'Экспедирование',
  'Склады и хранение',
]

const MAJOR_CITIES = [
  'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск',
  'Казань', 'Нижний Новгород', 'Самара', 'Ростов-на-Дону', 'Краснодар',
]

interface JobProgress {
  jobId: string
  state: LeadSearchJobStatus['state']
  progress: number
  result: LeadSearchJobStatus['result']
  failedReason: string | undefined
}

export function LeadSearchModal({ open, onClose, onComplete }: LeadSearchModalProps) {
  const [source, setSource] = useState<Source>('2gis')
  const [city, setCity] = useState('')
  const [industry, setIndustry] = useState('')
  const [limit, setLimit] = useState(50)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null)

  // Poll job status every 2 seconds
  const pollJob = useCallback(async (jobId: string) => {
    let done = false
    while (!done) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const { data } = await api.leadSources.jobStatus(jobId)
        const jp: JobProgress = {
          jobId,
          state: data.state,
          progress: typeof data.progress === 'number' ? data.progress : 0,
          result: data.result,
          failedReason: data.failedReason,
        }
        setJobProgress(jp)

        if (data.state === 'completed' || data.state === 'failed') {
          done = true
          if (data.state === 'completed' && data.result) {
            onComplete?.(data.result)
          }
        }
      } catch (pollError) {
        // Network or server error — transition to failed so the modal can be closed
        done = true
        setJobProgress((prev) => prev ? {
          ...prev,
          state: 'failed',
          failedReason: pollError instanceof Error ? pollError.message : 'Ошибка получения статуса задачи',
        } : null)
      }
    }
  }, [onComplete])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!city.trim()) {
      setError('Укажите город')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setJobProgress(null)

    try {
      const searchBody: import('@/lib/api-client').LeadSourceSearchBody = {
        source,
        city: city.trim(),
        limit,
      }
      if (industry.trim()) searchBody.industry = industry.trim()
      const { data } = await api.leadSources.search(searchBody)

      const initialProgress: JobProgress = { jobId: data.jobId!, state: 'waiting', progress: 0, result: undefined, failedReason: undefined }
      setJobProgress(initialProgress)
      pollJob(data.jobId!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запуска поиска')
      setIsSubmitting(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // Allow close at any time — but warn if a job is actively running
    if (jobProgress?.state === 'active' || jobProgress?.state === 'waiting') {
      // Still allow close; polling will stop naturally when the component unmounts
    }
    setJobProgress(null)
    setError(null)
    onClose()
  }

  const isRunning = jobProgress?.state === 'active' || jobProgress?.state === 'waiting'
  const isDone = jobProgress?.state === 'completed'
  const isFailed = jobProgress?.state === 'failed'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl bg-card border border-border shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Найти компании</h2>
          </div>
          {!isRunning && (
            <button
              onClick={handleClose}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Job progress view */}
        {jobProgress && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {isDone && <CheckCircle className="h-5 w-5 text-emerald-500" />}
              {isFailed && <AlertCircle className="h-5 w-5 text-destructive" />}
              <span className="text-sm font-medium text-foreground">
                {isRunning && 'Поиск выполняется...'}
                {isDone && 'Поиск завершён'}
                {isFailed && 'Ошибка поиска'}
              </span>
            </div>

            {/* Progress bar */}
            {(isRunning || isDone) && (
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isDone ? 'bg-emerald-500' : 'bg-primary',
                  )}
                  style={{ width: `${isDone ? 100 : Math.max(5, jobProgress.progress)}%` }}
                />
              </div>
            )}

            {/* Result stats */}
            {isDone && jobProgress.result && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Найдено', value: jobProgress.result.companiesFound },
                  { label: 'Добавлено', value: jobProgress.result.companiesImported },
                  { label: 'Дубли', value: jobProgress.result.companiesSkipped },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {isFailed && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                {jobProgress.failedReason ?? 'Неизвестная ошибка'}
              </p>
            )}

            {(isDone || isFailed) && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setJobProgress(null); setError(null) }}
                  className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Новый поиск
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Закрыть
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form view */}
        {!jobProgress && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            {/* Source selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Источник</label>
              <div className="grid grid-cols-2 gap-2">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSource(opt.value)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all',
                      source === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground',
                    )}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Город <span className="text-destructive">*</span>
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Например: Москва"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {MAJOR_CITIES.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCity(c)}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Отрасль / Ключевое слово
              </label>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Например: Транспорт и логистика"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {POPULAR_INDUSTRIES.slice(0, 4).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setIndustry(ind)}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Limit */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Количество компаний: <span className="text-primary font-semibold">{limit}</span>
              </label>
              <input
                type="range"
                min={10}
                max={200}
                step={10}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                <span>10</span>
                <span>200</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !city.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Найти
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
