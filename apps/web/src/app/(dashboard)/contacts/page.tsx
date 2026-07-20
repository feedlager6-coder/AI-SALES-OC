'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Search, Mail, Phone, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { api, type Contact } from '@/lib/api-client'

const SENIORITY_LABELS: Record<string, string> = {
  c_level: 'C-Level',
  vp: 'VP',
  director: 'Директор',
  manager: 'Менеджер',
  individual: 'Специалист',
}

function ContactAvatar({ contact }: { contact: Contact }) {
  const name = contact.fullName ?? [contact.firstName, contact.lastName].filter(Boolean).join(' ') ?? '?'
  const initial = name[0]?.toUpperCase() ?? '?'
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initial}
    </div>
  )
}

function ContactRow({ contact }: { contact: Contact }) {
  const displayName =
    contact.fullName ??
    ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Без имени')

  return (
    <tr className="hover:bg-muted/20 transition-colors group">
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ContactAvatar contact={contact} />
          <div>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            {contact.department && (
              <p className="text-xs text-muted-foreground">{contact.department}</p>
            )}
          </div>
        </div>
      </td>

      {/* Title + seniority */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{contact.title ?? '—'}</span>
          {contact.seniority && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {SENIORITY_LABELS[contact.seniority] ?? contact.seniority}
            </span>
          )}
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[180px]">{contact.email}</span>
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Phone */}
      <td className="px-4 py-3">
        {contact.phone ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            {contact.phone}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        {contact.companyId ? (
          <Link
            href={`/companies/${contact.companyId}`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Building2 className="h-3 w-3 shrink-0" />
            Открыть
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contacts', page, debouncedSearch],
    queryFn: () =>
      api.contacts.list({
        page,
        limit: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    staleTime: 30_000,
  })

  const contacts = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Контакты</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Все контакты из ваших компаний
            {meta && meta.total > 0 && (
              <span className="ml-1 text-foreground font-medium">· {meta.total}</span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени..."
          className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="h-10 bg-muted/30 border-b border-border" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive">Ошибка загрузки контактов. Попробуйте обновить страницу.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && contacts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-1">
            {debouncedSearch ? 'Контакты не найдены' : 'Нет контактов'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? 'Попробуйте изменить поисковый запрос'
              : 'Добавьте контакты через карточку компании'}
          </p>
          {!debouncedSearch && (
            <Link
              href="/companies"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Building2 className="h-4 w-4" />
              Перейти к компаниям
            </Link>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && contacts.length > 0 && (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Контакт
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Должность
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Телефон
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Компания
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <ContactRow key={contact.id} contact={contact} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Показано {(page - 1) * meta.limit + 1}–{Math.min(page * meta.limit, meta.total)} из {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Назад
                </button>
                <span className="text-sm text-muted-foreground px-1">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!meta.hasNextPage}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Вперёд <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
