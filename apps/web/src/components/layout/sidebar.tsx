'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  Mail,
  BarChart3,
  Settings,
  Zap,
  ChevronsUpDown,
  Search,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession, signOut } from '@/lib/auth-client'
import { useVipSession } from '@/components/vip-session-provider'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

const navItems = [
  { href: '/discover', label: 'Найти клиентов', icon: Search },
  { href: '/dashboard', label: 'Сегодня', icon: LayoutDashboard },
  { href: '/companies', label: 'Мои клиенты', icon: Building2 },
  { href: '/contacts', label: 'Контакты', icon: Users },
  { href: '/campaigns', label: 'Рассылки', icon: Mail },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
]

const bottomNavItems = [
  { href: '/sender-profile', label: 'О моей компании', icon: Briefcase },
  { href: '/settings', label: 'Настройки', icon: Settings },
]

function UserInitials({ name, email }: { name?: string | null; email?: string | null }) {
  const text = name ?? email ?? '?'
  const initial = text[0]?.toUpperCase() ?? '?'
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
      {initial}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  // Real Better Auth session (requires API + DB)
  const { data: session } = useSession()
  // VIP session (no DB needed — from httpOnly cookie via /api/vip-login)
  const vipUser = useVipSession()

  // Merge: real session takes priority; VIP is the fallback.
  // Typed loosely so both Better Auth's user shape and the VIP mock satisfy it.
  const user =
    (session?.user as { name?: string | null | undefined; email?: string | null | undefined } | undefined)
    ?? (vipUser ? { name: vipUser.name as string | null | undefined, email: vipUser.email as string | null | undefined } : null)
  const isVip = !session?.user && !!vipUser

  const { data: workspaceData } = useQuery({
    queryKey: ['workspace-me'],
    queryFn: () => api.workspace.me(),
    staleTime: 5 * 60 * 1000,
    // Only fetch when we have a real session — VIP users get a static workspace name
    enabled: !!session?.user,
  })
  const workspaceName = workspaceData?.data?.name ?? (isVip ? vipUser?.workspaceName : 'Рабочее пространство')

  async function handleSignOut() {
    if (isVip) {
      // VIP logout: clear the cookie via DELETE /api/vip-login
      await fetch('/api/vip-login', { method: 'DELETE', credentials: 'include' })
      router.push('/login')
      router.refresh()
    } else {
      await signOut()
      router.push('/login')
    }
  }

  return (
    <div
      className="flex w-[var(--sidebar-width)] flex-col border-r border-border bg-card"
      style={{ '--sidebar-width': '240px' } as React.CSSProperties}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shrink-0">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-foreground text-sm block truncate">AI Sales OS</span>
          <span className="text-[10px] text-muted-foreground block truncate leading-tight">{workspaceName}</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom nav + user */}
      <div className="p-2 pb-3 border-t border-border space-y-0.5">
        {bottomNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* User info */}
        {user && (
          <button
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-accent transition-colors group"
            title="Выйти"
          >
            <UserInitials name={user.name ?? null} email={user.email ?? null} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {user.name ?? user.email}
              </p>
              {user.name && (
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {user.email}
                </p>
              )}
            </div>
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          </button>
        )}
      </div>
    </div>
  )
}
