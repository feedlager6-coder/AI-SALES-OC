'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'default',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={
              variant === 'destructive'
                ? 'rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 transition-colors disabled:opacity-50'
                : 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
            }
          >
            {isPending ? 'Выполнение...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
