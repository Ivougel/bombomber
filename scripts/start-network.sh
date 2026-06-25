#!/usr/bin/env bash
# Запуск игрового сервера + публичный HTTPS-туннель для сетевой игры.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"
SUBDOMAIN="${TUNNEL_SUBDOMAIN:-bombomber-ivougel}"
URL_FILE="$ROOT/tunnel-url.txt"

cd "$ROOT/server"
if [[ ! -d node_modules ]]; then
  npm install
fi

if ! curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "→ Запуск сервера на :${PORT}..."
  npm start &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 30); do
    curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
else
  echo "→ Сервер уже слушает :${PORT}"
fi

echo ""
echo "→ Запуск туннеля (если поддомен занят — будет случайный URL)..."
echo ""

# Один процесс localtunnel; URL печатается в stderr/stdout
npx --yes localtunnel --port "$PORT" --local-host 127.0.0.1 --subdomain "$SUBDOMAIN" 2>&1 | tee /dev/stderr | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" =~ https://[a-z0-9-]+\.loca\.lt ]]; then
    URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.loca\.lt' | head -1)
    echo "$URL" > "$URL_FILE"
    echo ""
    echo "════════════════════════════════════════════"
    echo "  Туннель:  $URL"
    echo "  Health:   $URL/health"
    echo "  Игра:     https://ivougel.github.io/bombomber/"
    echo "  Или сразу: https://ivougel.github.io/bombomber/?server=$URL"
    echo "════════════════════════════════════════════"
    echo ""
  fi
done
