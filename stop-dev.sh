#!/usr/bin/env bash
# 停止 infinite-canvas 开发服务 (按端口 8080 / 3000 关闭)

for port in 8080 3000; do
  pids=$(netstat -ano 2>/dev/null | grep -E "LISTENING" | grep ":$port " | awk '{print $NF}' | sort -u)
  if [ -z "$pids" ]; then
    echo "端口 $port: 无运行进程"
  else
    for pid in $pids; do
      taskkill //PID "$pid" //F >/dev/null 2>&1 && echo "端口 $port: 已停止进程 $pid"
    done
  fi
done
