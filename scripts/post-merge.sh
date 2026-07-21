#!/usr/bin/env bash
# Post-merge setup script.
# Runs automatically after a task is merged. Must be non-interactive (stdin is /dev/null).
set -euo pipefail

echo "[post-merge] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[post-merge] Running DB migrations..."
cd packages/db && pnpm run db:migrate
cd ../..

echo "[post-merge] Building packages..."
pnpm turbo run build --filter='./packages/*'

echo "[post-merge] Post-merge setup complete."
