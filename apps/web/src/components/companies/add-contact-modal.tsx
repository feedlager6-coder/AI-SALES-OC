'use client'

import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { api } from '@/lib/api-client'

interface Props {
  companyId: string
  onClose: () => void
  onSuccess: () => void
}

type Seniority = 'c_level' | 'vp' | 'director' | 'manager' | 'individual'

const schema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  seniority: z.string().optional(), // validated below in mutationFn
  department: z.string().optional(),
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  phone: z.string().optional(),
  linkedinUrl: z.string().url('Некорректный URL').optional().or(z.literal('')),
  telegram: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const VALID_SENIORITY = new Set<string>(['c_level', 'vp', 'director', 'manager', 'individual'])

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

export function AddContactModal({ companyId, onClose, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      // Build payload omitting empty strings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = { companyId }
      if (data.firstName) payload.firstName = data.firstName
      if (data.lastName) payload.lastName = data.lastName
      if (data.title) payload.title = data.title
      if (data.seniority && VALID_SENIORITY.has(data.seniority)) {
        payload.seniority = data.seniority as Seniority
      }
      if (data.department) payload.department = data.department
      if (data.email) payload.email = data.email
      if (data.phone) payload.phone = data.phone
      if (data.linkedinUrl) payload.linkedinUrl = data.linkedinUrl
      if (data.telegram) payload.telegram = data.telegram
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return api.contacts.create(payload as any)
    },
    onSuccess,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Добавить контакт</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Имя</label>
              <input {...register('firstName')} placeholder="Иван" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Фамилия</label>
              <input {...register('lastName')} placeholder="Иванов" className={inputClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Должность</label>
            <input {...register('title')} placeholder="Директор по логистике" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Уровень</label>
              <select {...register('seniority')} className={inputClass}>
                <option value="">Не указан</option>
                <option value="c_level">C-Level</option>
                <option value="vp">VP</option>
                <option value="director">Director</option>
                <option value="manager">Manager</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Отдел</label>
              <input {...register('department')} placeholder="Продажи" className={inputClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="ivan@company.ru"
              className={inputClass}
            />
            {errors.email != null && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Телефон</label>
            <input {...register('phone')} placeholder="+7 999 123-45-67" className={inputClass} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Telegram</label>
            <input {...register('telegram')} placeholder="@username" className={inputClass} />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-500">
              {mutation.error instanceof Error ? mutation.error.message : 'Ошибка'}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
