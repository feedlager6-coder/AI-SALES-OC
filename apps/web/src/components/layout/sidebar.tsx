'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  Mail,
  BarChart3,
  Settings,
  Zap,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

const navItems = [
  { href: '/dashboard', label: 'Сегодня', icon: LayoutDashboard },
  { href: '/companies', label: 'Мои клиенты', icon: Building2 },
  { href: '/contacts', label: 'Контакты', icon: Users },
  { href: '/campaigns', label: 'Рассылки', icon: Mail },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
]

const bottomNavItems = [
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
  const { data: session } = useSession()
  const user = session?.user

  const { data: workspaceData } = useQuery({
    queryKey: ['workspace-me'],
    queryFn: () => api.workspace.me(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })
  const workspaceName = workspaceData?.data?.name ?? 'Рабочее пространство'

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
          <div className="mt-1 flex items-center gap-2.5 rounded-md px-3 py-2 cursor-default">
            <UserInitials name={user.name} email={user.email} />
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
          </div>
        )}
      </div>
    </div>
  )
}
