# Contributing to AI Sales OS
> Руководство для AI-агентов и разработчиков.

---

## Быстрый старт

```bash
# 1. Прочитай PROJECT_BIBLE.md и AI_HANDOFF.md
# 2. Настрой окружение
cp .env.example .env        # Заполни значения
docker compose up -d        # Запусти PostgreSQL + Redis
pnpm install
pnpm --filter @aisalesos/db migrate   # Применить миграции
pnpm dev                    # Запусти все сервисы
```

---

## Перед тем как писать код

1. **Прочитай PROJECT_BIBLE.md** — принципы и соглашения
2. **Прочитай docs/domain_model.md** — канонические сущности
3. **Прочитай docs/event_flow.md** — lifecycle лида
4. **Прочитай docs/plugin_architecture.md** — если добавляешь провайдера

---

## Структура веток

```
main          ← production-ready код
├── dev       ← интеграционная ветка
└── feat/*    ← фичи: feat/enrichment-hunter-plugin
└── fix/*     ← баги: fix/email-send-race-condition
└── docs/*    ← только документация
```

---

## Конвенция коммитов (Conventional Commits)

```
<type>(<scope>): <short description>

Types:
  feat     — новая функциональность
  fix      — исправление бага
  docs     — только документация
  refactor — рефакторинг без изменения поведения
  test     — добавление/изменение тестов
  chore    — инфраструктура, зависимости
  perf     — оптимизация производительности

Scopes:
  api, web, workers, db, plugins, ai, queue, types, config

Examples:
  feat(plugins): add Hunter.io email finder implementation
  fix(workers): fix race condition in sent_today counter
  docs(domain): clarify Company vs Lead naming convention
  feat(ai): implement Writer Agent with quality check
```

---

## Checklist перед PR

### Код
- [ ] TypeScript strict: нет `any`, нет `ts-ignore`
- [ ] Unit тесты для бизнес-логики
- [ ] Integration тест для новых API endpoints
- [ ] ESLint: нет warnings

### Безопасность  
- [ ] `workspace_id` проверяется в каждом DB запросе
- [ ] Zod schema на всех inputs
- [ ] Нет секретов в коде

### Наблюдаемость
- [ ] Pino логирование (не console.log)
- [ ] Ошибки — типизированные классы

### Документация
- [ ] ADR создан если архитектурное решение нетривиально
- [ ] `.env.example` обновлён для новых env vars
- [ ] JSDoc для публичных функций

### Деплой
- [ ] Работает в `docker compose up`
- [ ] Migration файл для schema changes

---

## Добавление нового плагина

1. Создай файл: `packages/plugins/implementations/{category}/{name}.ts`
2. Реализуй интерфейс из `packages/plugins/interfaces/`
3. Зарегистрируй: `packages/plugins/registry/register-all.ts`
4. Добавь env var в `.env.example`
5. Напиши тесты: `packages/plugins/implementations/{category}/__tests__/{name}.test.ts`

Подробности: `docs/plugin_architecture.md`

---

## Правило для AI-агентов

Если не уверен — добавь `// TODO: [вопрос]` в код и не угадывай.  
Лучше explicit question, чем silent wrong assumption.
