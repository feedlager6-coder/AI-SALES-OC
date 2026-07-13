'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Building2, Plus, Search, Upload, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { api, type Company, type CompanyFilters } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { CompanyForm } from '@/components/companies/company-form'
import { CsvImportModal } from '@/components/companies/csv-import-modal'

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
  new: 'bg-slate-100 text-slate-700',
  enriching: 'bg-blue-100 text-blue-700',
  enriched: 'bg-cyan-100 text-cyan-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  low_quality: 'bg-red-100 text-red-700',
  contacted: 'bg-violet-100 text-violet-700',
  replied: 'bg-purple-100 text-purple-700',
  meeting: 'bg-yellow-100 text-yellow-700',
  proposal: 'bg-orange-100 text-orange-700',
  negotiation: 'bg-amber-100 text-amber-700',
  won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-600',
  paused_30d: 'bg-gray-100 text-gray-600',
  opted_out: 'bg-gray-100 text-gray-500',
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
      ? 'text-emerald-600 font-bold'
      : score >= 50
        ? 'text-blue-600 font-semibold'
        : score >= 30
          ? 'text-amber-600'
          : 'text-red-500'
  return <span className={cn('text-sm tabular-nums', color)}>{score}</span>
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

export default function CompaniesPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<CompanyFilters>({ page: 1, limit: 20 })
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

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

  const handlePage = (delta: number) => {
    setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) + delta) }))
  }

  const totalPages = data ? Math.ceil(data.meta.total / (data.meta.limit)) : 1
  const currentPage = filters.page ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Компании</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data ? `${data.meta.total} компаний в базе` : 'Загрузка...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

        {isFetching && (
          <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Загрузка...
          </div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Компании не найдены</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-sm text-primary hover:underline"
            >
              Добавить первую компанию
            </button>
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
    </div>
  )
}
