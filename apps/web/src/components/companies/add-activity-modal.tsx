'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '@/lib/api-client'

interface Props {
  companyId: string
  onClose: () => void
  onSuccess: () => void
}

const TYPES = [
  { value: 'note', label: '📝 Заметка' },
  { value: 'call', label: '📞 Звонок' },
  { value: 'meeting', label: '🤝 Встреча' },
] as const

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

export function AddActivityModal({ companyId, onClose, onSuccess }: Props) {
  const [type, setType] = useState<'note' | 'call' | 'meeting'>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      // Build payload omitting empty strings so optional fields are absent
      const payload: Parameters<typeof api.companies.addActivity>[1] = { type }
      if (subject) payload.subject = subject
      if (body) payload.body = body
      return api.companies.addActivity(companyId, payload)
    },
    onSuccess,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Добавить запись</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Тип</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    type === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Тема</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Обсудили условия..."
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Заметка</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Детали разговора, следующие шаги..."
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-500">
              {mutation.error instanceof Error ? mutation.error.message : 'Ошибка'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
