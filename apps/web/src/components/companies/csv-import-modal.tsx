'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { api, type CreateCompanyBody } from '@/lib/api-client'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i])
    if (cols.every((c) => !c.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim().replace(/^"|"$/g, '') ?? ''
    })
    rows.push(row)
  }

  return rows
}

function splitCsvRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// Known column aliases → our field names
const FIELD_MAP: Record<string, keyof CreateCompanyBody> = {
  name: 'name',
  название: 'name',
  company: 'name',
  компания: 'name',
  inn: 'inn',
  инн: 'inn',
  city: 'city',
  город: 'city',
  industry: 'industry',
  отрасль: 'industry',
  website: 'website',
  сайт: 'website',
  domain: 'domain',
  домен: 'domain',
  phone: 'phones',
  телефон: 'phones',
  email: 'emails',
  почта: 'emails',
  region: 'region',
  регион: 'region',
  address: 'address',
  адрес: 'address',
  employees: 'employeesCount',
  сотрудников: 'employeesCount',
  employees_count: 'employeesCount',
}

function mapRow(row: Record<string, string>): CreateCompanyBody | null {
  const mapped: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    const fieldKey = FIELD_MAP[key.toLowerCase()]
    if (!fieldKey || !value) continue

    if (fieldKey === 'phones' || fieldKey === 'emails') {
      const existing = (mapped[fieldKey] as string[] | undefined) ?? []
      existing.push(value)
      mapped[fieldKey] = existing
    } else {
      mapped[fieldKey] = value
    }
  }

  // Name is required
  if (!mapped.name) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {
    name: mapped.name as string,
    phones: (mapped.phones as string[]) ?? [],
    emails: (mapped.emails as string[]) ?? [],
    source: 'csv',
  }
  if (mapped.inn) result.inn = mapped.inn
  if (mapped.city) result.city = mapped.city
  if (mapped.industry) result.industry = mapped.industry
  if (mapped.website) result.website = mapped.website
  if (mapped.domain) result.domain = mapped.domain
  if (mapped.region) result.region = mapped.region
  if (mapped.address) result.address = mapped.address
  if (mapped.employeesCount) result.employeesCount = mapped.employeesCount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CsvImportModal({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CreateCompanyBody[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (companies: CreateCompanyBody[]) => api.companies.import(companies),
    onSuccess,
  })

  const handleFile = (file: File) => {
    setFileName(file.name)
    setParseError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        const rows = parseCSV(text)
        const mapped = rows.map(mapRow).filter(Boolean) as CreateCompanyBody[]
        if (mapped.length === 0) {
          setParseError('Не найдено ни одной строки с полем "name" / "название"')
        } else {
          setPreview(mapped)
        }
      } catch {
        setParseError('Не удалось разобрать CSV')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Импорт из CSV</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Instructions */}
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Поддерживаемые колонки CSV:</p>
            <p>
              <code className="text-xs">name</code> (обязательно),{' '}
              <code className="text-xs">inn</code>, <code className="text-xs">city</code>,{' '}
              <code className="text-xs">industry</code>, <code className="text-xs">website</code>,{' '}
              <code className="text-xs">phone</code>, <code className="text-xs">email</code>,{' '}
              <code className="text-xs">region</code>, <code className="text-xs">employees</code>
            </p>
            <p className="text-xs">Заголовки поддерживаются на русском и английском.</p>
          </div>

          {/* Drop zone */}
          {!preview && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Перетащите CSV файл или <span className="text-primary">выберите</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{fileName}</span>
                <span className="text-foreground font-medium">— {preview.length} компаний</span>
              </div>
              <div className="rounded-md border border-border overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted-foreground">Название</th>
                      <th className="text-left px-3 py-2 text-muted-foreground">ИНН</th>
                      <th className="text-left px-3 py-2 text-muted-foreground">Город</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.inn ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.city ?? '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr className="border-t border-border">
                        <td colSpan={3} className="px-3 py-2 text-center text-muted-foreground">
                          ...и ещё {preview.length - 10}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  setPreview(null)
                  setFileName(null)
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Выбрать другой файл
              </button>
            </div>
          )}

          {/* Import result */}
          {mutation.isSuccess && (
            <div className="flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p>Импорт завершён: <strong>{mutation.data.data.imported}</strong> добавлено</p>
                {mutation.data.data.skipped > 0 && (
                  <p className="text-xs mt-1">Пропущено (дубликаты): {mutation.data.data.skipped}</p>
                )}
              </div>
            </div>
          )}

          {mutation.isError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {mutation.error instanceof Error ? mutation.error.message : 'Ошибка импорта'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {mutation.isSuccess ? 'Закрыть' : 'Отмена'}
          </button>
          {preview && !mutation.isSuccess && (
            <button
              onClick={() => mutation.mutate(preview)}
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Импорт...' : `Импортировать ${preview.length} компаний`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
