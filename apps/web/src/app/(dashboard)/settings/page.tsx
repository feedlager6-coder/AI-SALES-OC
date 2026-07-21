'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Trash2, Mail, CheckCircle, XCircle, Building2,
  Check, X, AlertCircle, Pencil,
} from 'lucide-react'
import { api, type EmailAccount, type CreateEmailAccountBody } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Workspace Settings Section ───────────────────────────────────────────────

function WorkspaceSettings() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const { data } = useQuery({
    queryKey: ['workspace-me'],
    queryFn: () => api.workspace.me(),
    staleTime: 5 * 60_000,
  })

  const workspace = data?.data

  const mutation = useMutation({
    mutationFn: (newName: string) => api.workspace.update({ name: newName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-me'] })
      toast.success('Название обновлено')
      setEditing(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const startEdit = () => {
    setName(workspace?.name ?? '')
    setEditing(true)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Рабочее пространство</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Основные параметры вашего аккаунта</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) mutation.mutate(name.trim())
                    if (e.key === 'Escape') setEditing(false)
                  }}
                  autoFocus
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => name.trim() && mutation.mutate(name.trim())}
                  disabled={mutation.isPending || !name.trim()}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-foreground truncate">
                  {workspace?.name ?? <span className="animate-pulse inline-block h-4 w-36 rounded bg-muted align-middle" />}
                </p>
                <button
                  onClick={startEdit}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Название отображается в интерфейсе и письмах
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Integration status table ─────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    name: 'Mailgun / SMTP',
    description: 'Отправка email-писем',
    envVars: ['MAILGUN_API_KEY + MAILGUN_DOMAIN', 'или BREVO_API_KEY'],
    type: 'dynamic' as const, // checked via email-accounts API
    docLink: 'https://documentation.mailgun.com',
  },
  {
    name: 'OpenAI',
    description: 'AI-персонализация писем и классификация ответов',
    envVars: ['OPENAI_API_KEY'],
    type: 'static' as const,
    configured: false,
  },
  {
    name: 'HH.ru',
    description: 'Поиск компаний по вакансиям (публичный API)',
    envVars: [],
    type: 'static' as const,
    configured: true,
  },
  {
    name: '2ГИС',
    description: 'Поиск компаний по городу и отрасли',
    envVars: ['TWOGIS_API_KEY'],
    type: 'static' as const,
    configured: false,
  },
  {
    name: 'Hunter.io',
    description: 'Поиск email по домену компании',
    envVars: ['HUNTER_API_KEY'],
    type: 'static' as const,
    configured: false,
  },
  {
    name: 'Snov.io',
    description: 'Обогащение контактов',
    envVars: ['SNOV_API_KEY'],
    type: 'static' as const,
    configured: false,
  },
  {
    name: 'Dadata',
    description: 'Обогащение данных о компаниях по ИНН',
    envVars: ['DADATA_API_KEY'],
    type: 'static' as const,
    configured: false,
  },
]

function IntegrationStatus() {
  const { data: emailAccountsData } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => api.emailAccounts.list(),
    staleTime: 60_000,
  })

  const hasEmailAccount = (emailAccountsData?.data?.length ?? 0) > 0

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Интеграции</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Статус подключения внешних сервисов. API-ключи устанавливаются через переменные окружения.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              {['Интеграция', 'Описание', 'Переменные окружения', 'Статус'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {INTEGRATIONS.map((integration) => {
              const isConfigured =
                integration.type === 'dynamic' ? hasEmailAccount : integration.configured

              return (
                <tr key={integration.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                    {integration.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[220px]">
                    {integration.description}
                  </td>
                  <td className="px-4 py-3">
                    {integration.envVars.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">не требуется</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {integration.envVars.map((v) => (
                          <code
                            key={v}
                            className="inline-block text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                          >
                            {v}
                          </code>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isConfigured ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        <Check className="h-3 w-3" />
                        Готово
                      </span>
                    ) : integration.envVars.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        <Check className="h-3 w-3" />
                        Готово
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 px-2.5 py-1 text-xs font-medium text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        Не настроено
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <strong>Как добавить API-ключи:</strong> Установите переменные окружения через панель Replit Secrets
        (или &nbsp;<code className="font-mono">.env</code>&nbsp; файл в локальной разработке) и перезапустите API-сервер.
      </div>
    </section>
  )
}

// ─── Add Email Account Modal ──────────────────────────────────────────────────

function AddEmailAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    provider: 'mailgun' as 'mailgun' | 'brevo' | 'ses' | 'smtp',
    apiKey: '',
    domain: '',
    dailyLimit: 50,
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: CreateEmailAccountBody) => api.emailAccounts.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-accounts'] })
      toast.success('Email аккаунт добавлен')
      onClose()
      setForm({ email: '', displayName: '', provider: 'mailgun', apiKey: '', domain: '', dailyLimit: 50 })
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message)
      toast.error(err.message)
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="border-b border-border p-5">
          <h2 className="text-lg font-semibold text-foreground">Добавить email аккаунт</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Укажите провайдера и данные для отправки писем
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.email) { setError('Введите email адрес'); return }
            if (form.provider === 'mailgun' && (!form.apiKey || !form.domain)) {
              setError('Для Mailgun необходимы API Key и Domain')
              return
            }
            setError(null)

            const credentials: CreateEmailAccountBody['credentials'] = {}
            if (form.provider === 'mailgun') {
              credentials.apiKey = form.apiKey
              credentials.domain = form.domain
            }

            mutation.mutate({
              email: form.email,
              ...(form.displayName ? { displayName: form.displayName } : {}),
              provider: form.provider,
              credentials,
              dailyLimit: form.dailyLimit,
            })
          }}
          className="space-y-4 p-5"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Email адрес
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="sales@yourcompany.ru"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Имя отправителя
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Алексей из CompanyName"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Провайдер
            </label>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as typeof f.provider }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="mailgun">Mailgun</option>
              <option value="brevo">Brevo (SendinBlue)</option>
              <option value="ses">Amazon SES</option>
              <option value="smtp">SMTP</option>
            </select>
          </div>

          {form.provider === 'mailgun' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mailgun API Key
                </label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder="key-..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mailgun Domain
                </label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder="mg.yourcompany.ru"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Дневной лимит писем
            </label>
            <input
              type="number"
              min={1}
              max={2000}
              value={form.dailyLimit}
              onChange={(e) => setForm((f) => ({ ...f, dailyLimit: Number(e.target.value) }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Рекомендуется: 30–50/день для прогрева, 100–200/день после прогрева
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Email Account Card ───────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  mailgun: 'Mailgun',
  brevo: 'Brevo',
  ses: 'Amazon SES',
  smtp: 'SMTP',
}

function EmailAccountCard({ account }: { account: EmailAccount }) {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.emailAccounts.delete(account.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-accounts'] })
      toast.success('Email аккаунт удалён')
      setConfirmDelete(false)
    },
    onError: (err: Error) => { toast.error(err.message); setConfirmDelete(false) },
  })

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api.emailAccounts.update(account.id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-accounts'] })
      toast.success(account.isActive ? 'Аккаунт отключён' : 'Аккаунт активирован')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className={cn(
      'rounded-xl border bg-card p-5 transition-opacity',
      !account.isActive && 'opacity-60',
      account.isActive ? 'border-border' : 'border-dashed border-border',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{account.email}</p>
              {account.isActive ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
            {account.displayName && (
              <p className="text-sm text-muted-foreground truncate">{account.displayName}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{PROVIDER_LABELS[account.provider] ?? account.provider}</span>
              <span>•</span>
              <span>до {account.dailyLimit} писем/день</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleMutation.mutate(!account.isActive)}
            disabled={toggleMutation.isPending}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors',
              account.isActive
                ? 'border-border text-muted-foreground hover:bg-accent'
                : 'border-border text-emerald-400 hover:bg-emerald-900/20',
            )}
          >
            {account.isActive ? 'Отключить' : 'Включить'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <ConfirmDialog
            open={confirmDelete}
            title="Удалить email аккаунт?"
            description={`${account.email} будет удалён. Активные кампании продолжат отправку через другие аккаунты.`}
            confirmLabel="Удалить"
            variant="destructive"
            isPending={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setConfirmDelete(false)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => api.emailAccounts.list(),
  })

  const accounts = data?.data ?? []

  return (
    <div className="space-y-10 max-w-3xl">
      {/* Workspace Settings */}
      <WorkspaceSettings />

      {/* Divider */}
      <hr className="border-border" />

      {/* Email Accounts section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Email аккаунты</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Аккаунты для отправки outreach-писем
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Добавить аккаунт
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted shrink-0" />
                    <div className="space-y-2">
                      <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-7 w-20 animate-pulse rounded-lg bg-muted" />
                    <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-destructive">Ошибка загрузки аккаунтов</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Нет email аккаунтов</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Добавьте аккаунт Mailgun или SMTP для отправки писем
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Добавить аккаунт
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <EmailAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}

        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <strong>Совет:</strong> Для максимальной доставляемости настройте SPF, DKIM и DMARC для вашего домена
          в панели Mailgun. Начните с лимита 30–50 писем/день и постепенно увеличивайте.
        </div>
      </section>

      {/* Divider */}
      <hr className="border-border" />

      {/* Integration status */}
      <IntegrationStatus />

      <AddEmailAccountModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
