'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { api, type Company } from '@/lib/api-client'

const SOURCE_OPTIONS = ['manual', 'csv', '2gis', 'hhru', 'api'] as const

const schema = z.object({
  name: z.string().min(1, 'Обязательное поле'),
  inn: z.string().optional(),
  legalName: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  website: z.string().optional(),
  domain: z.string().optional(),
  address: z.string().optional(),
  employeesCount: z.string().optional(),
  source: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  company?: Company
  onClose: () => void
  onSuccess: () => void
}

// Using `string | undefined` explicitly for exactOptionalPropertyTypes compatibility
interface FieldProps {
  label: string
  error?: string | undefined
  children: React.ReactNode
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error != null && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

export function CompanyForm({ company, onClose, onSuccess }: Props) {
  const isEdit = !!company
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? '',
      inn: company?.inn ?? '',
      legalName: company?.legalName ?? '',
      industry: company?.industry ?? '',
      city: company?.city ?? '',
      region: company?.region ?? '',
      website: company?.website ?? '',
      domain: company?.domain ?? '',
      address: company?.address ?? '',
      employeesCount: company?.employeesCount ?? '',
      source: company?.source ?? 'manual',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      // Build payload omitting empty/undefined values
      const payload: Record<string, unknown> = {
        name: data.name,
        source: data.source ?? 'manual',
      }
      if (data.inn) payload.inn = data.inn
      if (data.legalName) payload.legalName = data.legalName
      if (data.industry) payload.industry = data.industry
      if (data.city) payload.city = data.city
      if (data.region) payload.region = data.region
      if (data.website) payload.website = data.website
      if (data.domain) payload.domain = data.domain
      if (data.address) payload.address = data.address
      if (data.employeesCount) payload.employeesCount = data.employeesCount

      return isEdit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? api.companies.update(company!.id, payload as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : api.companies.create(payload as any)
    },
    onSuccess,
    onError: (err) => {
      setServerError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {isEdit ? 'Редактировать компанию' : 'Добавить компанию'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSubmit={handleSubmit((data) => mutation.mutate(data as any))}
          className="p-6 space-y-4"
        >
          {serverError != null && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Field label="Название *" error={errors.name?.message}>
            <input {...register('name')} placeholder="ООО Рога и Копыта" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="ИНН" error={errors.inn?.message}>
              <input {...register('inn')} placeholder="7712345678" className={inputClass} />
            </Field>
            <Field label="Юридическое название" error={errors.legalName?.message}>
              <input {...register('legalName')} placeholder="ООО «Название»" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Отрасль" error={errors.industry?.message}>
              <input {...register('industry')} placeholder="Логистика" className={inputClass} />
            </Field>
            <Field label="Количество сотрудников" error={errors.employeesCount?.message}>
              <input {...register('employeesCount')} placeholder="50-200" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Город" error={errors.city?.message}>
              <input {...register('city')} placeholder="Москва" className={inputClass} />
            </Field>
            <Field label="Регион" error={errors.region?.message}>
              <input {...register('region')} placeholder="Московская область" className={inputClass} />
            </Field>
          </div>

          <Field label="Сайт" error={errors.website?.message}>
            <input {...register('website')} placeholder="https://example.com" className={inputClass} />
          </Field>

          <Field label="Домен" error={errors.domain?.message}>
            <input {...register('domain')} placeholder="example.com" className={inputClass} />
          </Field>

          <Field label="Адрес" error={errors.address?.message}>
            <input {...register('address')} placeholder="ул. Пушкина, д. 1" className={inputClass} />
          </Field>

          <Field label="Источник" error={errors.source?.message}>
            <select {...register('source')} className={inputClass}>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'manual' ? 'Вручную' : opt === 'csv' ? 'CSV' : opt === '2gis' ? '2ГИС' : opt === 'hhru' ? 'HH.ru' : 'API'}
                </option>
              ))}
            </select>
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
