'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Анализирую запрос',        delayMs: 500  },
  { label: 'Ищу компании',             delayMs: 1300 },
  { label: 'Нахожу контакты',          delayMs: 2100 },
  { label: 'Подготавливаю результаты', delayMs: 2900 },
]

/** Called when the animation finishes (after the last step appears) */
interface SearchProgressProps {
  query: string
  onComplete: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchProgress({ query, onComplete }: SearchProgressProps) {
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []

    STEPS.forEach((step, i) => {
      timeouts.push(
        setTimeout(() => {
          setDoneSteps((prev) => new Set(prev).add(i))
          setActiveStep(i + 1)

          // After the last step, call onComplete with a short pause
          if (i === STEPS.length - 1) {
            timeouts.push(setTimeout(onComplete, 450))
          }
        }, step.delayMs),
      )
    })

    return () => timeouts.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-10 animate-in fade-in duration-300">

      {/* Icon + heading */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary animate-pulse" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Ищу подходящие компании...
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto truncate">
            «{query}»
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3">
        {STEPS.map((step, i) => {
          const done    = doneSteps.has(i)
          const active  = !done && activeStep === i
          const pending = !done && !active

          return (
            <div
              key={step.label}
              className={cn(
                'flex items-center gap-3 transition-opacity duration-300',
                pending ? 'opacity-30' : 'opacity-100',
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : active ? (
                <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
              ) : (
                <div className="h-4 w-4 shrink-0 rounded-full border border-border" />
              )}
              <span
                className={cn(
                  'text-sm transition-colors duration-200',
                  done    ? 'text-foreground font-medium' :
                  active  ? 'text-foreground' :
                            'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
