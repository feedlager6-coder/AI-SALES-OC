'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Дашборд',
  '/companies': 'Компании',
  '/contacts': 'Контакты',
  '/campaigns': 'Кампании',
  '/analytics': 'Аналитика',
  '/settings': 'Настройки',
}

function usePageTitle(): string {
  const pathname = usePathname()
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Prefix match for nested routes (e.g. /companies/[id])
  for (const [prefix, label] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix + '/')) return label
  }
  return ''
}

export function Header() {
  const router = useRouter()
  const title = usePageTitle()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </header>
  )
}
