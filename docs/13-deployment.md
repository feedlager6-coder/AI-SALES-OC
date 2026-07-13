# Deployment — AI Sales OS

## Стратегия деплоя по фазам

### Фаза 1 (MVP, 0–3 мес): Single VPS
**Цель**: быстро, дёшево, работает. Всё на одном сервере.

**Почему не Kubernetes сразу**: K8s overhead (learning curve, YAML-hell, управление кластером) неоправдан для MVP с 3–5 клиентами. Один мощный VPS + Docker Compose достаточен до 50 workspaces.

### Фаза 2 (Growth, 3–12 мес): Managed Services
Разделяем stateful компоненты на managed сервисы (Postgres → managed, Redis → managed), app остаётся в Docker.

### Фаза 3 (Scale, 12+ мес): Kubernetes
При необходимости горизонтального масштабирования workers — Kubernetes.

---

## Фаза 1: Docker Compose (MVP)

### Инфраструктура

```
Hetzner CX32 (€15/мес)
  4 vCPU, 8 GB RAM, 80 GB SSD
  OS: Ubuntu 22.04 LTS
  Location: Германия / Хельсинки

ИЛИ для РФ-данных:
Selectel или Yandex Cloud
  Аналогичные характеристики
```

### `docker-compose.prod.yml`

```yaml
version: '3.9'

services:
  # Reverse Proxy + TLS
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

  # Frontend
  web:
    image: ghcr.io/org/ai-sales-os-web:${VERSION}
    environment:
      - NEXT_PUBLIC_API_URL=https://api.domain.com
    restart: unless-stopped

  # Backend API
  api:
    image: ghcr.io/org/ai-sales-os-api:${VERSION}
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on: [postgres, redis]
    restart: unless-stopped

  # Background Workers
  worker-enrichment:
    image: ghcr.io/org/ai-sales-os-workers:${VERSION}
    command: ["node", "dist/workers/enrichment.js"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped
    deploy:
      replicas: 2   # 2 воркера параллельно

  worker-email:
    image: ghcr.io/org/ai-sales-os-workers:${VERSION}
    command: ["node", "dist/workers/email.js"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - MAILGUN_API_KEY=${MAILGUN_API_KEY}
    restart: unless-stopped

  worker-ai:
    image: ghcr.io/org/ai-sales-os-workers:${VERSION}
    command: ["node", "dist/workers/ai.js"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    restart: unless-stopped
    deploy:
      replicas: 2

  # Databases
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=aisalesos
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # Мониторинг
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  prometheus_data:
  grafana_data:
```

### Caddyfile

```
api.yourdomain.com {
  reverse_proxy api:3001
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Frame-Options DENY
    X-Content-Type-Options nosniff
  }
}

app.yourdomain.com {
  reverse_proxy web:3000
}

monitoring.yourdomain.com {
  basicauth { admin {$GRAFANA_HTPASSWD} }
  reverse_proxy grafana:3000
}
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm audit --audit-level=high

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker images
        run: |
          docker build -f apps/web/Dockerfile -t ghcr.io/org/web:${{ github.sha }} .
          docker build -f apps/api/Dockerfile -t ghcr.io/org/api:${{ github.sha }} .
          docker build -f apps/workers/Dockerfile -t ghcr.io/org/workers:${{ github.sha }} .
      - name: Push to GHCR
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/org/web:${{ github.sha }}
          docker push ghcr.io/org/api:${{ github.sha }}
          docker push ghcr.io/org/workers:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ai-sales-os
            export VERSION=${{ github.sha }}
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml run --rm api node dist/migrate.js  # migrations
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
```

### Стратегия деплоя: Rolling Update
```
1. Новый контейнер api запускается рядом со старым
2. Healthcheck: GET /health → 200
3. Caddy перенаправляет трафик на новый
4. Старый контейнер останавливается
```

Downtime: 0 (zero-downtime deployment через Docker Compose + Caddy).

---

## Мониторинг и алерты

### Healthcheck endpoints
```typescript
// GET /health
{
  status: 'ok',
  uptime: 12345,
  db: 'connected',
  redis: 'connected',
  queues: {
    enrichment: { waiting: 12, active: 2, failed: 0 },
    email: { waiting: 45, active: 5, failed: 1 }
  }
}

// GET /metrics (Prometheus format)
http_requests_total{method="POST",route="/api/campaigns"} 1234
queue_depth{queue="enrichment"} 12
ai_tokens_used_total{model="gpt-4o"} 45678
```

### Grafana Dashboard (ключевые панели)
1. Request rate + error rate + latency (RED metrics)
2. Queue depth по каждой очереди
3. AI cost per day (tokens × price)
4. Email delivery rate (sent vs bounced)
5. Active workspaces и лиды в обработке

### Алерты (Alertmanager → Telegram)
```yaml
- alert: HighErrorRate
  expr: rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 2m
  annotations:
    summary: "Error rate > 5%"

- alert: QueueBacklog
  expr: queue_depth{queue="enrichment"} > 5000
  for: 5m
  annotations:
    summary: "Enrichment queue backed up"

- alert: AIProviderDown
  expr: ai_request_success_rate < 0.9
  for: 3m
  annotations:
    summary: "AI provider issues"
```

---

## Бэкап

### PostgreSQL
```bash
# Ежедневный backup (cron: 3:00 AM)
pg_dump -h postgres -U app aisalesos | gzip > /backups/db-$(date +%Y%m%d).sql.gz
# Ротация: хранить 30 дней локально, 90 дней в S3
```

### Проверка восстановления
Ежемесячно: полное восстановление в staging-окружении из последнего backup.

---

## Переменные окружения (полный список)

```bash
# Database
DATABASE_URL=postgresql://app:pass@postgres:5432/aisalesos
POSTGRES_PASSWORD=<secret>

# Cache
REDIS_URL=redis://:pass@redis:6379
REDIS_PASSWORD=<secret>

# Auth
JWT_SECRET=<256-bit-random>
JWT_REFRESH_SECRET=<256-bit-random>
ENCRYPTION_KEY=<32-byte-hex>

# AI
OPENAI_API_KEY=<key>
ANTHROPIC_API_KEY=<key>

# Email
MAILGUN_API_KEY=<key>
MAILGUN_DOMAIN=mail.yourdomain.com

# Integrations
TELEGRAM_BOT_TOKEN=<token>
TWOGIS_API_KEY=<key>
HUNTER_API_KEY=<key>
DADATA_API_KEY=<key>

# App
NODE_ENV=production
APP_URL=https://app.yourdomain.com
API_URL=https://api.yourdomain.com
PORT=3001

# Monitoring
SENTRY_DSN=<dsn>
GRAFANA_PASSWORD=<secret>
```

---

## Environments

| Environment | Назначение | URL | DB |
|------------|-----------|-----|-----|
| **local** | Разработка | localhost:3000 | docker-compose local |
| **staging** | Тестирование перед релизом | staging.domain.com | Отдельная БД, seed данные |
| **production** | Реальные клиенты | app.domain.com | Production БД |

**Правило**: миграции сначала запускаются в staging, затем в production. Никогда напрямую в prod без staging-валидации.
