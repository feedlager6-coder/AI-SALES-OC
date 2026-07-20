'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Building2, Plus, Search, Upload, RefreshCw, ChevronLeft, ChevronRight, Zap, SlidersHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { api, type Company, type CompanyFilters } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { CompanyForm } from '@/components/companies/company-form'
import { CsvImportModal } from '@/components/companies/csv-import-modal'
import { LeadSearchModal } from '@/components/companies/lead-search-modal'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  enriching: 'Обогащение',
  enriched: 'Обогащён',
  qualified: 'Квалифицирован',
  low_quality: 'Низкое качество',
  contacted: 'Связались',
  replied: 'Ответил',
  meeting: 'Встреча',
  proposal: 'КП отправлено',
  negotiation: 'Переговоры',
  won: 'Сделка',
  closed_lost: 'Отказ',
  paused_30d: 'Пауза',
  opted_out: 'Отписался',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-700/50 text-slate-300',
  enriching: 'bg-blue-900/60 text-blue-300',
  enriched: 'bg-cyan-900/60 text-cyan-300',
  qualified: 'bg-emerald-900/60 text-emerald-300',
  low_quality: 'bg-red-900/60 text-red-300',
  contacted: 'bg-violet-900/60 text-violet-300',
  replied: 'bg-purple-900/60 text-purple-300',
  meeting: 'bg-yellow-900/60 text-yellow-300',
  proposal: 'bg-orange-900/60 text-orange-300',
  negotiation: 'bg-amber-900/60 text-amber-300',
  won: 'bg-green-900/60 text-green-300',
  closed_lost: 'bg-red-900/60 text-red-400',
  paused_30d: 'bg-gray-800/60 text-gray-400',
  opted_out: 'bg-gray-800/60 text-gray-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function IcpScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? 'text-emerald-400 font-bold'
      : score >= 50
        ? 'text-blue-400 font-semibold'
        : score >= 30
          ? 'text-amber-400'
          : 'text-red-400'
  return <span className={cn('text-sm tabular-nums', color)}>{score}</span>
}

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    '2gis': '2ГИС',
    'hhru': 'HH.ru',
    'csv': 'CSV',
    'manual': 'Вручную',
    'api': 'API',
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
      {labels[source] ?? source}
    </span>
  )
}

// ─── Table columns ────────────────────────────────────────────────────────────

const columns: ColumnDef<Company>[] = [
  {
    id: 'name',
    header: 'Компания',
    cell: ({ row }) => (
      <div>
        <Link
          href={`/companies/${row.original.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {row.original.name}
        </Link>
        {row.original.inn && (
          <p className="text-xs text-muted-foreground mt-0.5">ИНН: {row.original.inn}</p>
        )}
      </div>
    ),
  },
  {
    id: 'city',
    header: 'Город',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.city ?? '—'}</span>
    ),
  },
  {
    id: 'industry',
    header: 'Отрасль',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.industry ?? '—'}</span>
    ),
  },
  {
    id: 'source',
    header: 'Источник',
    cell: ({ row }) => <SourceBadge source={row.original.source} />,
  },
  {
    id: 'status',
    header: 'Статус',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'icpScore',
    header: 'ICP',
    cell: ({ row }) => <IcpScoreBadge score={row.original.icpScore} />,
  },
  {
    id: 'enrichment',
    header: 'Данные',
    cell: ({ row }) => {
      const s = row.original.enrichmentStatus
      return (
        <span className="text-xs text-muted-foreground capitalize">
          {s === 'pending' ? 'Ожидание' : s === 'in_progress' ? 'В процессе' : s === 'done' ? 'Готово' : 'Ошибка'}
        </span>
      )
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Link
        href={`/companies/${row.original.id}`}
        className="text-xs text-primary hover:underline"
      >
        Открыть →
      </Link>
    ),
  },
]

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: '', label: 'Все статусы' },
  { value: 'new', label: 'Новые' },
  { value: 'qualified', label: 'Квалифицированные' },
  { value: 'enriched', label: 'Обогащённые' },
  { value: 'contacted', label: 'Контакт установлен' },
  { value: 'low_quality', label: 'Низкое качество' },
]

const SOURCES = [
  { value: '', label: 'Все источники' },
  { value: '2gis', label: '2ГИС' },
  { value: 'hhru', label: 'HH.ru' },
  { value: 'csv', label: 'CSV' },
  { value: 'manual', label: 'Вручную' },
]

export default function CompaniesPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<CompanyFilters>({ page: 1, limit: 20 })
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showLeadSearch, setShowLeadSearch] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  // ICP slider state (local — applied on "Apply" or slider release)
  const [icpRange, setIcpRange] = useState<[number, number]>([0, 100])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => api.companies.list(filters),
  })

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.meta.total / data.meta.limit) : 0,
  })

  const handleSearch = useCallback(() => {
    setFilters((f) => {
      const next: CompanyFilters = { ...f, page: 1 }
      if (search) next.search = search
      else delete next.search
      return next
    })
  }, [search])

  const handleStatusChange = (status: string) => {
    setFilters((f) => {
      const next: CompanyFilters = { ...f, page: 1 }
      if (status) next.status = status
      else delete next.status
      return next
    })
  }

  const handleSourceChange = (source: string) => {
    setFilters((f) => {
      const next: CompanyFilters = { ...f, page: 1 }
      if (source) next.source = source
      else delete next.source
      return next
    })
  }

  const applyIcpFilter = () => {
    setFilters((f) => {
      const next: CompanyFilters = { ...f, page: 1 }
      if (icpRange[0] > 0) next.icpMin = icpRange[0]
      else delete next.icpMin
      if (icpRange[1] < 100) next.icpMax = icpRange[1]
      else delete next.icpMax
      return next
    })
  }

  const resetIcpFilter = () => {
    setIcpRange([0, 100])
    setFilters((f) => {
      const next = { ...f, page: 1 }
      delete next.icpMin
      delete next.icpMax
      return next
    })
  }

  const handlePage = (delta: number) => {
    setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) + delta) }))
  }

  const totalPages = data ? Math.ceil(data.meta.total / (data.meta.limit)) : 1
  const currentPage = filters.page ?? 1
  const hasActiveFilters = filters.status || filters.source || filters.icpMin !== undefined || filters.icpMax !== undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Компании</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data
              ? data.meta.total === 0
                ? 'Нет компаний — добавьте первую'
                : `${data.meta.total} ${data.meta.total === 1 ? 'компания' : data.meta.total < 5 ? 'компании' : 'компаний'} в базе`
              : <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted align-middle" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeadSearch(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Найти компании
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Upload className="h-4 w-4" />
            Импорт CSV
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 min-w-72">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Поиск по названию, ИНН..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* Status filter */}
          <select
            value={filters.status ?? ''}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none cursor-pointer"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Source filter */}
          <select
            value={filters.source ?? ''}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none cursor-pointer"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Advanced filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
              showFilters || filters.icpMin !== undefined || filters.icpMax !== undefined
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-accent',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            ICP фильтр
          </button>

          {isFetching && (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          )}

          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilters({ page: 1, limit: 20 })
                setSearch('')
                setIcpRange([0, 100])
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        {/* ICP range slider panel */}
        {showFilters && (
          <div className="rounded-lg border border-border bg-card p-4 flex items-end gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-3">
                ICP Score:{' '}
                <span className="text-primary font-semibold">
                  {icpRange[0]} — {icpRange[1]}
                </span>
                {(filters.icpMin !== undefined || filters.icpMax !== undefined) && (
                  <span className="ml-2 text-xs text-muted-foreground">(применён)</span>
                )}
              </label>
              {/* Min slider */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">Мин</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={icpRange[0]}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setIcpRange(([, max]) => [Math.min(val, max - 5), max])
                    }}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs text-foreground w-8 text-right tabular-nums">{icpRange[0]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">Макс</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={icpRange[1]}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setIcpRange(([min]) => [min, Math.max(val, min + 5)])
                    }}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs text-foreground w-8 text-right tabular-nums">{icpRange[1]}</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Не в ICP (&lt;30)</span>
                <span className="text-amber-400">Нейтральный (30–49)</span>
                <span className="text-blue-400">Квалифицирован (50–74)</span>
                <span className="text-emerald-400">Высокий (≥75)</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={applyIcpFilter}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Применить
              </button>
              {(filters.icpMin !== undefined || filters.icpMax !== undefined) && (
                <button
                  onClick={resetIcpFilter}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Компания','Город','Отрасль','Источник','Статус','ICP','Данные',''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="h-3.5 w-20 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-3.5 w-28 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-12 animate-pulse rounded-full bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-3.5 w-8 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-3.5 w-14 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-3"><div className="h-3.5 w-14 animate-pulse rounded bg-muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Компании не найдены</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeadSearch(true)}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Zap className="h-3.5 w-3.5" />
                Найти компании в 2ГИС / HH.ru
              </button>
              <span className="text-muted-foreground">или</span>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-sm text-primary hover:underline"
              >
                Добавить вручную
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-accent/50 transition-colors',
                    i % 2 === 0 ? '' : 'bg-muted/20',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.meta.total > data.meta.limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Показано {(currentPage - 1) * data.meta.limit + 1}–
            {Math.min(currentPage * data.meta.limit, data.meta.total)} из {data.meta.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePage(-1)}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Назад
            </button>
            <span className="px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePage(1)}
              disabled={!data.meta.hasNextPage}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Вперёд <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateForm && (
        <CompanyForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false)
            queryClient.invalidateQueries({ queryKey: ['companies'] })
          }}
        />
      )}
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false)
            queryClient.invalidateQueries({ queryKey: ['companies'] })
          }}
        />
      )}
      {showLeadSearch && (
        <LeadSearchModal
          open={showLeadSearch}
          onClose={() => setShowLeadSearch(false)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['companies'] })
          }}
        />
      )}
    </div>
  )
}
