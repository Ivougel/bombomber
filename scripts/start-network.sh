#!/usr/bin/env bash
# Запуск игрового сервера + публичный HTTPS-туннель для сетевой игры.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"
SUBDOMAIN="${TUNNEL_SUBDOMAIN:-bombomber-ivougel}"
SERVER_URL="https://${SUBDOMAIN}.loca.lt"

cd "$ROOT/server"
if [[ ! -d node_modules ]]; then
  npm install
fi

if ! curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  echo "→ Запуск сервера на :${PORT}..."
  npm start &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 30); do
    curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
else
  echo "→ Сервер уже слушает :${PORT}"
fi

echo ""
echo "════════════════════════════════════════════"
echo "  Bombomber — сетевой сервер"
echo "  Локально:  http://localhost:${PORT}"
echo "  Туннель:   ${SERVER_URL}"
echo "  Health:    ${SERVER_URL}/health"
echo ""
echo "  GitHub Pages подключается к этому URL."
echo "  Другой URL: ?server=https://ваш-туннель"
echo "════════════════════════════════════════════"
echo ""

npx --yes localtunnel --port "$PORT" --subdomain "$SUBDOMAIN"
