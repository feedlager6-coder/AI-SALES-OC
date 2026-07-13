# Security — AI Sales OS

## Модель угроз

### Основные активы для защиты
1. **Данные лидов и компаний** — коммерческая тайна клиентов
2. **Персональные данные контактов** — email, телефоны, ФИО (152-ФЗ / GDPR)
3. **API-ключи внешних сервисов** — деньги и доступ к инфраструктуре
4. **Email-репутация** — домены для отправки писем
5. **Модели AI-промптов** — конкурентное преимущество

### Основные угрозы

| Угроза | Вектор | Уровень риска |
|-------|--------|--------------|
| Утечка данных другого тенанта | Ошибка в WHERE clause, отсутствие workspace_id | Критический |
| Кража API-ключей | Логи, переменные окружения, XSS | Высокий |
| Prompt injection | Злонамеренные данные лида в AI-промпте | Высокий |
| Спам через нашу инфраструктуру | Компрометированный аккаунт | Высокий |
| Brute force / credential stuffing | Login endpoint | Средний |
| IDOR (Insecure Direct Object Reference) | Доступ к чужому ресурсу по ID | Высокий |

---

## Аутентификация и авторизация

### JWT-схема
```
Access Token:  срок 15 минут, payload = {userId, workspaceId, role}
Refresh Token: срок 30 дней, stored in httpOnly cookie
                rotated при каждом обновлении (refresh token rotation)
```

**Почему 15 минут**: короткий TTL ограничивает окно после утечки токена. Refresh через httpOnly cookie — недоступен JS (защита от XSS).

### RBAC-матрица

| Действие | Owner | Admin | Manager | SDR |
|---------|-------|-------|---------|-----|
| Настройки workspace | ✅ | ✅ | ❌ | ❌ |
| Управление пользователями | ✅ | ✅ | ❌ | ❌ |
| Подключение email ящиков | ✅ | ✅ | ❌ | ❌ |
| Создание кампаний | ✅ | ✅ | ✅ | ❌ |
| Запуск кампаний | ✅ | ✅ | ✅ | ❌ |
| Просмотр всех лидов | ✅ | ✅ | ✅ | ✅* |
| Редактирование лидов | ✅ | ✅ | ✅ | ✅* |
| Экспорт данных | ✅ | ✅ | ✅ | ❌ |
| Просмотр analytics | ✅ | ✅ | ✅ | ❌ |
| Биллинг | ✅ | ❌ | ❌ | ❌ |

*SDR видит только лиды, назначенные ему или в его кампаниях.

### Middleware авторизации
```typescript
// Каждый запрос проходит через:
async function authMiddleware(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyJWT(token);              // throws if invalid/expired
  
  const workspace = await getWorkspace(payload.workspaceId);
  if (!workspace || workspace.suspended) throw ForbiddenError();
  
  // Устанавливаем контекст для RLS
  await db.execute(sql`SET app.current_workspace_id = ${payload.workspaceId}`);
  
  req.user = { ...payload, workspace };
  next();
}
```

---

## Изоляция данных (мультитенантность)

### Уровень 1: Application (обязательный)
Каждый ORM-запрос автоматически добавляет `workspace_id`:
```typescript
// В Drizzle ORM — кастомный query builder
const leads = await db.query.companies.findMany({
  where: eq(companies.workspaceId, ctx.workspaceId)  // ВСЕГДА
});
```

### Уровень 2: PostgreSQL RLS (резервный)
```sql
-- Включено на всех таблицах с workspace_id
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON companies
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
```

RLS срабатывает даже при ошибке в application layer — двойная защита.

---

## Шифрование

### At-rest
```typescript
// API ключи внешних сервисов — AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes, из secrets

function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.hex}:${authTag.hex}:${encrypted}`;
}
```

**Что шифруется**: `api_keys.key_encrypted`, `email_accounts.credentials`

**Что НЕ шифруется в поле** (защищается RLS + access control): email, телефоны лидов

### In-transit
- TLS 1.3 обязателен на всех endpoints
- HSTS: `max-age=31536000; includeSubDomains`
- Certificate Transparency logging включён

---

## Защита API

### Rate Limiting
```typescript
// Nginx / application-level
const limits = {
  'POST /auth/login':          { window: '15min', max: 5 },    // brute force
  'POST /auth/refresh':        { window: '5min', max: 10 },
  '/api/*':                    { window: '1min', max: 100 },   // authenticated
  '/webhooks/*':               { window: '1min', max: 1000 },  // high-volume
};
```

### OWASP Top 10 защита

| Уязвимость | Защита |
|-----------|--------|
| SQL Injection | Drizzle ORM prepared statements; никакого raw SQL с user input |
| XSS | Content-Security-Policy header; DOMPurify для rich text |
| CSRF | SameSite=Strict cookies; CSRF token для state-changing requests |
| IDOR | workspace_id проверяется на каждый запрос; RLS |
| Security Misconfiguration | Helmet.js headers; secrets только через env vars |
| Broken Auth | httpOnly refresh tokens; short-lived access tokens |
| Mass Assignment | Zod схемы на input; never spread req.body в ORM |
| Server-Side Request Forgery | Whitelist для external URL fetching в scraper |

### Input Validation
```typescript
// Каждый endpoint имеет Zod-схему
const createLeadSchema = z.object({
  name: z.string().min(1).max(500).trim(),
  inn: z.string().regex(/^\d{10,12}$/).optional(),
  website: z.string().url().optional(),
  // ... строго типизировано
});
// Fastify автоматически возвращает 400 при несоответствии
```

---

## Безопасность AI

### Prompt Injection Prevention
```typescript
// ПЛОХО: прямая вставка в system prompt
const prompt = `System: ${userCompanyDescription} Напиши письмо...`;

// ХОРОШО: данные — в отдельном user-блоке, system — только наш
const messages = [
  { role: 'system', content: FIXED_SYSTEM_PROMPT },
  { role: 'user', content: `Данные компании: ${JSON.stringify(sanitizedData)}\nЗадача: ...` }
];
```

Пользовательские данные (описание компании с сайта, текст вакансий) всегда идут как `role: user`, никогда в системный промпт.

### Sanitization AI Input
```typescript
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/system:/gi, '[системное:')       // нейтрализация injection
    .replace(/ignore previous/gi, '[игнор...')
    .slice(0, 2000);                            // ограничение размера
}
```

---

## Аудит-лог

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id     UUID,
  action      VARCHAR(100) NOT NULL,  -- 'lead.create', 'campaign.start', 'user.login'
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  occurred_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (occurred_at);   -- партиционирование по месяцам
```

**Политика хранения**: 12 месяцев. После — архив или удаление.

Audit log — append-only: никаких UPDATE/DELETE через приложение. Только INSERT.

---

## Соответствие 152-ФЗ

| Требование | Реализация |
|-----------|-----------|
| Согласие на обработку | Terms of Service при регистрации; checkbox при импорте ПД |
| Локализация данных | Деплой в РФ (Selectel, Yandex Cloud) — опциональный режим |
| Право на удаление | API endpoint `DELETE /contacts/{id}` — hard delete + cascade |
| Реестр обработки | Таблица `data_processing_log` с целями и основаниями |
| Уведомление при утечке | SLA: 72 часа → уведомление Роскомнадзора (шаблон готов) |

---

## Секреты и конфигурация

**Правило**: ни одного секрета в коде или `.env` файле в репозитории.

```bash
# .env.example (в repo — только шаблон без значений)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ENCRYPTION_KEY=<32-byte-hex>
OPENAI_API_KEY=<from-secrets-manager>
JWT_SECRET=<random-256bit>

# .env (в .gitignore, локально)
# В production — через Docker secrets / K8s secrets / Replit secrets
```

**Ротация**: JWT_SECRET и ENCRYPTION_KEY ротируются раз в 90 дней (процедура задокументирована в runbook).

---

## Dependency Security

- `npm audit` в CI/CD pipeline — fail при high/critical уязвимостях
- Dependabot автообновления для security patches
- Pinned versions в `package-lock.json`
- Base Docker image: `node:22-alpine` (минимальный attack surface)
- Container scanning: Trivy в CI
