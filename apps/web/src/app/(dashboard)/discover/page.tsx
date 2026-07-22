'use client'

import { useState } from 'react'
import { Search, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const EXAMPLES = [
  'Строительные компании в Москве',
  'Юридические фирмы в Казани',
  'Логистические компании с 20–100 сотрудниками',
]

export default function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSubmitted(true)
  }

  const handleExample = (text: string) => {
    setQuery(text)
    setSubmitted(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4">
      <div className="w-full max-w-2xl space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Кого вы ищете?
          </h1>
          <p className="text-muted-foreground text-sm">
            Опишите целевую аудиторию — мы найдём подходящих клиентов
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <textarea
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSubmitted(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={3}
              placeholder="Например: строительные компании в Москве с 50–200 сотрудниками"
              className={cn(
                'w-full resize-none rounded-xl border bg-card px-12 py-4 text-sm text-foreground',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'transition-colors',
                submitted
                  ? 'border-primary/50 ring-1 ring-primary/20'
                  : 'border-border hover:border-border/80',
              )}
            />
          </div>

          <button
            type="submit"
            disabled={!query.trim()}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3',
              'text-sm font-semibold transition-all',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            Найти клиентов
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Result stub */}
        {submitted && (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-sm font-medium text-foreground">
              Запрос принят: <span className="text-primary">«{query}»</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Следующий этап разработки — здесь появятся результаты поиска
            </p>
          </div>
        )}

        {/* Examples */}
        {!submitted && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
              Примеры запросов
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleExample(example)}
                  className={cn(
                    'w-full text-left rounded-lg border border-border bg-card px-4 py-3',
                    'text-sm text-muted-foreground hover:text-foreground',
                    'hover:border-primary/30 hover:bg-accent',
                    'transition-all duration-150',
                    'group flex items-center justify-between',
                  )}
                >
                  <span>{example}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
