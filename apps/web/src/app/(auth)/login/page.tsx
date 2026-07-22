import { LoginForm } from '@/components/auth/login-form'
import { Zap, Building2, Mail, Target } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between bg-card border-r border-border p-10 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AI Sales OS</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground leading-snug mb-3">
            Найдите клиентов<br />за несколько минут
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Опишите кого ищете — система найдёт компании, подготовит контакты и напишет первое письмо за вас.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: Building2, text: 'Поиск компаний через 2ГИС и HH.ru' },
              { icon: Mail, text: 'AI-персонализация каждого письма' },
              { icon: Target, text: 'Аналитика воронки и reply rate' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © 2026 AI Sales OS
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-2">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">AI Sales OS</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">Войдите в аккаунт</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Нет аккаунта?{' '}
              <a href="/register" className="text-primary hover:underline font-medium">
                Зарегистрироваться
              </a>
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  )
}
