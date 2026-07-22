'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Bell } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Сегодня',
  '/companies': 'Мои клиенты',
  '/contacts': 'Контакты',
  '/campaigns': 'Рассылки',
  '/analytics': 'Аналитика',
  '/settings': 'Настройки',
}

function useBreadcrumb(): { label: string; isDetail: boolean } {
  const pathname = usePathname()
  if (PAGE_TITLES[pathname]) return { label: PAGE_TITLES[pathname], isDetail: false }
  for (const [prefix, label] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix + '/')) return { label, isDetail: true }
  }
  return { label: '', isDetail: false }
}

export function Header() {
  const router = useRouter()
  const { label, isDetail } = useBreadcrumb()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {isDetail ? (
          <>
            <button
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-medium">Детали</span>
          </>
        ) : (
          <span className="font-medium text-foreground">{label}</span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Уведомления"
          aria-label="Уведомления"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Выйти"
        >
          <LogOut className="h-3.5 w-3.5" />
          Выйти
        </button>
      </div>
    </header>
  )
}
