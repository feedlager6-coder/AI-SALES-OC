'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Mail, CheckCircle, XCircle } from 'lucide-react'
import { api, type EmailAccount, type CreateEmailAccountBody } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Параметры аккаунта и рабочего пространства
        </p>
      </div>

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

        {/* Mailgun info */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <strong>Tip:</strong> Для максимальной доставляемости настройте SPF, DKIM и DMARC для вашего домена
          в панели Mailgun. Начните с лимита 30–50 писем/день и постепенно увеличивайте.
        </div>
      </section>

      <AddEmailAccountModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
