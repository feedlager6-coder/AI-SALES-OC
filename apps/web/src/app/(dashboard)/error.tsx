'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Что-то пошло не так</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Произошла неожиданная ошибка. Попробуйте обновить страницу.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-muted-foreground font-mono">ID: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  )
}
