#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PROJECT_ID="${PROJECT_ID:-ssr-app}"
export PM2_APP_NAME="${PM2_APP_NAME:-${PROJECT_ID}-web}"
export PM2_LOG_DIRECTORY="${PM2_LOG_DIRECTORY:-/data/logs/${PM2_APP_NAME}}"
readonly PM2_HEALTHCHECK_URL="${PM2_HEALTHCHECK_URL:-http://127.0.0.1:${PORT:-3001}/${PROJECT_ID}-api/health}"
readonly PM2_HEALTHCHECK_ATTEMPTS="${PM2_HEALTHCHECK_ATTEMPTS:-20}"
readonly PM2_HEALTHCHECK_INTERVAL_SECONDS="${PM2_HEALTHCHECK_INTERVAL_SECONDS:-1}"
readonly PM2_SAVE_AFTER_HEALTH="${PM2_SAVE_AFTER_HEALTH:-true}"

# PM2 不会主动创建多层日志目录，部署入口统一在启动前准备。
mkdir -p "$PM2_LOG_DIRECTORY"

if ! [[ "$PM2_HEALTHCHECK_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "PM2_HEALTHCHECK_ATTEMPTS must be a positive integer." >&2
  exit 1
fi

if ! [[ "$PM2_HEALTHCHECK_INTERVAL_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "PM2_HEALTHCHECK_INTERVAL_SECONDS must be a positive integer." >&2
  exit 1
fi

if [[ "$PM2_SAVE_AFTER_HEALTH" != "true" && "$PM2_SAVE_AFTER_HEALTH" != "false" ]]; then
  echo "PM2_SAVE_AFTER_HEALTH must be true or false." >&2
  exit 1
fi

pm2 startOrReload ecosystem.config.cjs --update-env

# 只有新进程通过本机健康或 readiness 探测后才持久化 PM2 状态。
for ((attempt = 1; attempt <= PM2_HEALTHCHECK_ATTEMPTS; attempt += 1)); do
  if curl --fail --silent --show-error --max-time 3 --output /dev/null "$PM2_HEALTHCHECK_URL"; then
    if [[ "$PM2_SAVE_AFTER_HEALTH" == "true" ]]; then
      pm2 save
    else
      echo "PM2 state not saved; complete remaining release gates, then run pm2 save."
    fi
    exit 0
  fi

  if ((attempt < PM2_HEALTHCHECK_ATTEMPTS)); then
    sleep "$PM2_HEALTHCHECK_INTERVAL_SECONDS"
  fi
done

echo "PM2 health check failed: ${PM2_HEALTHCHECK_URL}" >&2
exit 1
