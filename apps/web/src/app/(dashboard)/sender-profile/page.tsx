'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  User,
  MessageSquare,
  Globe,
  Phone,
  Mail,
  Briefcase,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSenderProfile } from '@/lib/sender-profile'
import { EMPTY_SENDER_PROFILE } from '@/lib/sender-profile'
import type { SenderProfile, Tone, Language } from '@/lib/sender-profile'

// ─── Field Components ──────────────────────────────────────────────────────────

function FieldGroup({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground -mt-0.5">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors'

const textareaCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none'

function SectionCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

// ─── Advantages editor ─────────────────────────────────────────────────────────

function AdvantagesEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const add = () => onChange([...value, ''])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const update = (i: number, v: string) =>
    onChange(value.map((item, idx) => (idx === i ? v : item)))

  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Преимущество ${i + 1}`}
            className={cn(inputCls, 'flex-1')}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" />
        Добавить преимущество
      </button>
    </div>
  )
}

// ─── Tone / Language selectors ─────────────────────────────────────────────────

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: 'formal', label: 'Официальный', hint: 'Деловая переписка, холодные ЛПР' },
  { value: 'professional', label: 'Профессиональный', hint: 'Баланс делового и дружелюбного' },
  { value: 'friendly', label: 'Дружелюбный', hint: 'Стартапы, IT, малый бизнес' },
]

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

function ToneSelector({
  value,
  onChange,
}: {
  value: Tone
  onChange: (t: Tone) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TONES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-lg border px-3 py-2.5 text-left transition-colors',
            value === t.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          <p className="text-xs font-semibold">{t.label}</p>
          <p className="text-[10px] mt-0.5 leading-snug opacity-70">{t.hint}</p>
        </button>
      ))}
    </div>
  )
}

function LanguageSelector({
  value,
  onChange,
}: {
  value: Language
  onChange: (l: Language) => void
}) {
  return (
    <div className="flex gap-2">
      {LANGUAGES.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => onChange(l.value)}
          className={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
            value === l.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

// ─── Completeness indicator ────────────────────────────────────────────────────

const REQUIRED_FIELDS: (keyof SenderProfile)[] = [
  'companyName',
  'industry',
  'description',
  'senderName',
  'senderPosition',
  'email',
]

function CompletenessBar({ profile }: { profile: SenderProfile }) {
  const filled = REQUIRED_FIELDS.filter((f) => {
    const v = profile[f]
    return Array.isArray(v) ? v.length > 0 : Boolean(v)
  }).length
  const pct = Math.round((filled / REQUIRED_FIELDS.length) * 100)
  const allDone = filled === REQUIRED_FIELDS.length

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {allDone ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium text-foreground">
            {allDone ? 'Профиль заполнен' : 'Заполните профиль'}
          </span>
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            allDone ? 'bg-emerald-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!allDone && (
        <p className="mt-2 text-xs text-muted-foreground">
          Обязательные поля: название компании, отрасль, описание, имя и должность отправителя, email.
        </p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SenderProfilePage() {
  const { profile, isLoading, isSaving, save } = useSenderProfile()

  const [form, setForm] = useState<SenderProfile>(EMPTY_SENDER_PROFILE)
  const [isDirty, setIsDirty] = useState(false)

  // Populate form once profile loads from localStorage
  useEffect(() => {
    if (!isLoading && profile) {
      setForm(profile)
    }
  }, [isLoading, profile])

  function patch<K extends keyof SenderProfile>(key: K, value: SenderProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setIsDirty(true)
  }

  async function handleSave() {
    await save(form)
    setIsDirty(false)
    toast.success('Профиль сохранён')
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-40 animate-pulse rounded bg-muted mb-4" />
            <div className="space-y-3">
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">О моей компании</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Этот профиль используется всеми AI-компонентами при генерации сообщений.
            Заполните его один раз — AI всегда будет знать, от кого пишет.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            isDirty
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {/* Completeness */}
      <CompletenessBar profile={form} />

      {/* Section 1: Company */}
      <SectionCard title="О компании" icon={Building2}>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Название компании *">
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => patch('companyName', e.target.value)}
              placeholder="ООО «Пример»"
              className={inputCls}
            />
          </FieldGroup>
          <FieldGroup label="Отрасль *">
            <input
              type="text"
              value={form.industry}
              onChange={(e) => patch('industry', e.target.value)}
              placeholder="Логистика, IT, Строительство..."
              className={inputCls}
            />
          </FieldGroup>
        </div>

        <FieldGroup
          label="Чем занимается компания *"
          hint="2–3 предложения. AI использует это как базу для персонализации"
        >
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => patch('description', e.target.value)}
            placeholder="Мы разрабатываем SaaS-платформу для управления складом. Наши клиенты — средние и крупные ритейлеры..."
            className={textareaCls}
          />
        </FieldGroup>

        <FieldGroup
          label="Идеальный клиент"
          hint="Кому вы продаёте? Размер, отрасль, должность ЛПР"
        >
          <textarea
            rows={2}
            value={form.idealCustomers}
            onChange={(e) => patch('idealCustomers', e.target.value)}
            placeholder="Директора по логистике в компаниях 50–500 сотрудников, сектор ритейл и e-commerce"
            className={textareaCls}
          />
        </FieldGroup>

        <FieldGroup label="Сайт компании">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              value={form.website}
              onChange={(e) => patch('website', e.target.value)}
              placeholder="https://example.ru"
              className={cn(inputCls, 'pl-9')}
            />
          </div>
        </FieldGroup>
      </SectionCard>

      {/* Section 2: Advantages */}
      <SectionCard title="Ключевые преимущества" icon={Briefcase}>
        <p className="text-xs text-muted-foreground -mt-1">
          Конкретные УТП, которые AI будет вплетать в письма. Чем конкретнее — тем лучше.
        </p>
        <AdvantagesEditor
          value={form.advantages}
          onChange={(v) => patch('advantages', v)}
        />
      </SectionCard>

      {/* Section 3: Sender identity */}
      <SectionCard title="Данные отправителя" icon={User}>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Имя и фамилия *">
            <input
              type="text"
              value={form.senderName}
              onChange={(e) => patch('senderName', e.target.value)}
              placeholder="Алексей Иванов"
              className={inputCls}
            />
          </FieldGroup>
          <FieldGroup label="Должность *">
            <input
              type="text"
              value={form.senderPosition}
              onChange={(e) => patch('senderPosition', e.target.value)}
              placeholder="Руководитель отдела продаж"
              className={inputCls}
            />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Email *">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => patch('email', e.target.value)}
                placeholder="alexey@example.ru"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </FieldGroup>
          <FieldGroup label="Телефон">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => patch('phone', e.target.value)}
                placeholder="+7 (999) 123-45-67"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </FieldGroup>
        </div>
      </SectionCard>

      {/* Section 4: Communication settings */}
      <SectionCard title="Стиль общения" icon={MessageSquare}>
        <FieldGroup label="Тон сообщений">
          <ToneSelector value={form.tone} onChange={(t) => patch('tone', t)} />
        </FieldGroup>

        <FieldGroup label="Язык писем">
          <LanguageSelector value={form.language} onChange={(l) => patch('language', l)} />
        </FieldGroup>

        <FieldGroup
          label="Подпись"
          hint="Добавляется в конец каждого письма. Поддерживается plain text"
        >
          <textarea
            rows={3}
            value={form.signature}
            onChange={(e) => patch('signature', e.target.value)}
            placeholder={`С уважением,\nАлексей Иванов\nРуководитель отдела продаж | ООО «Пример»\n+7 (999) 123-45-67`}
            className={textareaCls}
          />
        </FieldGroup>
      </SectionCard>

      {/* Bottom save bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {isDirty
            ? '⚠ Есть несохранённые изменения'
            : profile
            ? '✓ Профиль актуален'
            : 'Профиль не заполнен — AI не сможет генерировать персональные сообщения'}
        </p>
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            isDirty
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  )
}
