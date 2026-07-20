'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
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
    <html lang="ru" className="dark">
      <body className="bg-background text-foreground flex min-h-screen items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Критическая ошибка</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Приложение столкнулось с критической ошибкой. Пожалуйста, обновите страницу.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground font-mono">ID: {error.digest}</p>
            )}
          </div>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  )
}
