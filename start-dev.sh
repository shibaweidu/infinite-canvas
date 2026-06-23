#!/usr/bin/env bash
# infinite-canvas 一键启动 (git bash / Unix shell)
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$PATH:/c/Program Files/Go/bin"

echo "========================================"
echo "  启动 infinite-canvas 开发服务"
echo "========================================"

# 后端已在运行就跳过
if curl -s -m 2 http://127.0.0.1:8080/api/health 2>/dev/null | grep -q ok; then
  echo "后端已在运行 (8080)，跳过。"
else
  echo "启动后端 (8080)，日志: $ROOT/backend.log"
  (cd "$ROOT" && go run . >"$ROOT/backend.log" 2>&1 &)
fi

echo "启动前端 (3002)，日志: $ROOT/web/frontend.log"
(cd "$ROOT/web" && bun run dev >"$ROOT/web/frontend.log" 2>&1 &)

echo ""
echo "等待服务就绪..."
for i in $(seq 1 30); do
  sleep 1
  if curl -s -m 2 http://127.0.0.1:3002/api/health 2>/dev/null | grep -q ok; then
    echo ""
    echo "✓ 服务就绪，访问 http://localhost:3002"
    echo "  停止服务: bash stop-dev.sh"
    exit 0
  fi
done

echo "前端可能还在编译，稍等后访问 http://localhost:3002"
echo "查看日志: tail -f web/frontend.log  /  tail -f backend.log"
