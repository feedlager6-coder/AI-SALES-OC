'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2,
  MapPin,
  Globe,
  Phone,
  Mail,
  ArrowLeft,
  Users,
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { api, type Contact, type Activity } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { CompanyForm } from '@/components/companies/company-form'
import { AddActivityModal } from '@/components/companies/add-activity-modal'
import { AddContactModal } from '@/components/companies/add-contact-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Status helpers ───────────────────────────────────────────────────────────

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

const ACTIVITY_ICONS: Record<string, string> = {
  email_sent: '📧',
  email_opened: '👁',
  email_clicked: '🖱',
  email_replied: '↩️',
  call: '📞',
  meeting: '🤝',
  note: '📝',
  status_change: '🔄',
  enrichment_completed: '✨',
  deal_created: '💼',
  deal_stage_changed: '🏷',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground text-sm w-36 shrink-0">{label}</span>
      <span className="text-sm text-foreground break-words">{value}</span>
    </div>
  )
}

function IcpBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-blue-500' : score >= 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums w-8 text-right">{score}</span>
    </div>
  )
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-foreground text-sm">{contact.fullName ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Без имени')}</p>
          {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
        </div>
        {contact.seniority && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground capitalize">
            {contact.seniority.replace('_', ' ')}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
            <Mail className="h-3 w-3" /> {contact.email}
          </a>
        )}
        {contact.phone && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" /> {contact.phone}
          </p>
        )}
      </div>
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  const icon = ACTIVITY_ICONS[activity.type] ?? '•'
  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      <div className="mt-0.5 text-lg w-6 text-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          {activity.subject ?? activity.type.replace(/_/g, ' ')}
        </p>
        {activity.body && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activity.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(activity.occurredAt)}</p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'contacts' | 'timeline' | 'deals'

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('contacts')
  const [showEdit, setShowEdit] = useState(false)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: companyData, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.companies.get(id),
    enabled: !!id,
  })

  const { data: contactsData } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: () => api.companies.contacts(id),
    enabled: !!id && activeTab === 'contacts',
  })

  const { data: activitiesData } = useQuery({
    queryKey: ['company-activities', id],
    queryFn: () => api.companies.activities(id),
    enabled: !!id && activeTab === 'timeline',
  })

  const enrichMutation = useMutation({
    mutationFn: () => api.companies.enrich(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.companies.delete(id),
    onSuccess: () => router.push('/companies'),
  })

  const company = companyData?.data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Загрузка...
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Building2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Компания не найдена</p>
        <Link href="/companies" className="text-primary hover:underline text-sm">← Вернуться к списку</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Компании
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{company.name}</h1>
            {company.legalName && company.legalName !== company.name && (
              <p className="text-sm text-muted-foreground">{company.legalName}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {company.city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {company.city}
                </span>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Globe className="h-3 w-3" /> {company.domain ?? company.website}
                </a>
              )}
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {STATUS_LABELS[company.status] ?? company.status}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => enrichMutation.mutate()}
            disabled={enrichMutation.isPending || company.enrichmentStatus === 'in_progress'}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', enrichMutation.isPending && 'animate-spin')} />
            Обогатить
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Редактировать
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 rounded-md border border-red-900/50 bg-card px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — company info */}
        <div className="space-y-4">
          {/* ICP Score */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              ICP Score
            </p>
            <IcpBar score={company.icpScore} />
            <p className="text-xs text-muted-foreground mt-2">
              {company.icpScore >= 75 ? '🟢 Высокий приоритет' : company.icpScore >= 50 ? '🔵 Квалифицирован' : company.icpScore >= 30 ? '🟡 Под вопросом' : '🔴 Не в ICP'}
            </p>
          </div>

          {/* Details */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Реквизиты</p>
            <InfoRow label="ИНН" value={company.inn} />
            <InfoRow label="ОГРН" value={company.ogrn} />
            <InfoRow label="Отрасль" value={company.industry} />
            <InfoRow label="Город" value={company.city} />
            <InfoRow label="Регион" value={company.region} />
            <InfoRow label="Сотрудников" value={company.employeesCount} />
            {company.revenueRub && (
              <InfoRow label="Выручка" value={`${(company.revenueRub / 1_000_000).toFixed(1)} млн ₽`} />
            )}
          </div>

          {/* Contacts */}
          {company.phones.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Телефоны</p>
              {company.phones.map((p) => (
                <a key={p} href={`tel:${p}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
                  <Phone className="h-3 w-3 text-muted-foreground" /> {p}
                </a>
              ))}
            </div>
          )}

          {company.emails.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
              {company.emails.map((e) => (
                <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="h-3 w-3" /> {e}
                </a>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Мета</p>
            <InfoRow label="Источник" value={company.source} />
            <InfoRow label="Добавлен" value={formatDate(company.createdAt)} />
            <InfoRow label="Обновлён" value={formatDate(company.updatedAt)} />
            {company.enrichedAt && (
              <InfoRow label="Обогащён" value={formatDate(company.enrichedAt)} />
            )}
          </div>
        </div>

        {/* Right column — tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex items-center border-b border-border gap-0">
            {([
              { id: 'contacts', label: 'Контакты', icon: Users, count: company._counts?.contacts },
              { id: 'timeline', label: 'Timeline', icon: Clock, count: company._counts?.activities },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="bg-muted text-muted-foreground text-xs rounded-full px-1.5 py-0.5 min-w-5 text-center">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contacts tab */}
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {contactsData?.data.length ?? 0} контактов
                </p>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  + Добавить контакт
                </button>
              </div>
              {!contactsData ? (
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              ) : contactsData.data.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Контактов нет</p>
                  <button
                    onClick={() => setShowAddContact(true)}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Добавить первый контакт
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {contactsData.data.map((c) => (
                    <ContactCard key={c.id} contact={c} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">История активности</p>
                <button
                  onClick={() => setShowAddActivity(true)}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  + Добавить запись
                </button>
              </div>
              {!activitiesData ? (
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              ) : activitiesData.data.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Активности нет</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card divide-y divide-border">
                  {activitiesData.data.map((a) => (
                    <div key={a.id} className="px-4">
                      <ActivityItem activity={a} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <CompanyForm
          company={company}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false)
            queryClient.invalidateQueries({ queryKey: ['company', id] })
            queryClient.invalidateQueries({ queryKey: ['companies'] })
          }}
        />
      )}
      {showAddActivity && (
        <AddActivityModal
          companyId={id}
          onClose={() => setShowAddActivity(false)}
          onSuccess={() => {
            setShowAddActivity(false)
            queryClient.invalidateQueries({ queryKey: ['company-activities', id] })
            queryClient.invalidateQueries({ queryKey: ['company', id] })
          }}
        />
      )}
      {showAddContact && (
        <AddContactModal
          companyId={id}
          onClose={() => setShowAddContact(false)}
          onSuccess={() => {
            setShowAddContact(false)
            queryClient.invalidateQueries({ queryKey: ['company-contacts', id] })
            queryClient.invalidateQueries({ queryKey: ['company', id] })
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Удалить компанию?"
        description={`«${company.name}» будет удалена. Все контакты и активности по ней сохранятся в базе.`}
        confirmLabel="Удалить"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
