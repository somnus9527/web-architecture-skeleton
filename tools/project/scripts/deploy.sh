#!/usr/bin/env bash
#
# 软链发布/回滚。制品由 scripts/build.sh 生成，本脚本只负责部署。
#
# 用法：
#   bash scripts/deploy.sh release --app-root /var/www/<app> \
#     --artifact <app>-<release>.tar.gz --release-id <id> [--health-url URL] [--no-reload]
#   bash scripts/deploy.sh rollback --app-root /var/www/<app> [--to <id>] \
#     [--health-url URL] [--no-reload]
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

COMMAND="${1:-}"
if [[ -n "$COMMAND" ]]; then shift; fi

APP_ROOT="${APP_ROOT:-}"
ARTIFACT=""
RELEASE_ID=""
TARGET_RELEASE=""
HEALTH_URL="${HEALTH_URL:-}"
NO_RELOAD=false
SKIP_VERIFY=false
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-20}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-1}"
CDN_PURGE_CMD="${CDN_PURGE_CMD:-}"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/deploy.sh release --app-root <dir> --artifact <tar.gz|dir> --release-id <id> [options]
  bash scripts/deploy.sh rollback --app-root <dir> [--to <id>] [options]

Options:
  --app-root <dir>       Deployment root containing releases/, current, previous (or APP_ROOT env)
  --release-root <dir>   Alias of --app-root
  --artifact <path>      Release tarball or directory; required only when releases/<id> is absent
  --release-id <id>      Release id, also used as releases/<id>
  --to <id>              Rollback target release id (default: previous link)
  --health-url <url>     HTTP health/version URL; empty skips with a warning
  --no-reload            Do not run nginx reload or pm2 startOrReload
  --skip-verify          Skip SHA256SUMS verification
  -h, --help             Show this help

Environment:
  CDN_PURGE_CMD          Optional shell command to purge the version URL after release/rollback.
                         It receives RELEASE_ID, APP_ROOT and HEALTH_URL in its environment.

Examples:
  APP_ROOT=/var/www/my-app bash scripts/deploy.sh release \
    --artifact ./spa-20261126.tar.gz --release-id 20261126-1030-abc1234 \
    --health-url https://app.example.com/my-app/version.json
  APP_ROOT=/var/www/my-app bash scripts/deploy.sh rollback
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-root|--release-root) APP_ROOT="${2:?$1 requires a value}"; shift 2 ;;
    --artifact) ARTIFACT="${2:?--artifact requires a value}"; shift 2 ;;
    --release-id) RELEASE_ID="${2:?--release-id requires a value}"; shift 2 ;;
    --to) TARGET_RELEASE="${2:?--to requires a value}"; shift 2 ;;
    --health-url) HEALTH_URL="${2:?--health-url requires a value}"; shift 2 ;;
    --no-reload) NO_RELOAD=true; shift ;;
    --skip-verify) SKIP_VERIFY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ "$COMMAND" == "-h" || "$COMMAND" == "--help" ]]; then
  usage
  exit 0
fi

# 兼容旧发布包：在解压后的 SSR 目录里直接执行 `bash deploy.sh`。
# 新流程应使用 `deploy.sh release --app-root ... --artifact ...`。
legacy_pm2_deploy() {
  local project_id="${PROJECT_ID:-ssr-app}"
  local app_name="${PM2_APP_NAME:-${project_id}-web}"
  local log_dir="${PM2_LOG_DIRECTORY:-/data/logs/${app_name}}"
  local health_url="${PM2_HEALTHCHECK_URL:-${HEALTH_URL:-http://127.0.0.1:${PORT:-3001}/${project_id}-api/health}}"
  local attempts="${PM2_HEALTHCHECK_ATTEMPTS:-20}"
  local interval="${PM2_HEALTHCHECK_INTERVAL_SECONDS:-1}"

  mkdir -p "$log_dir"
  pm2 startOrReload ecosystem.config.cjs --update-env

  local attempt
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 3 --output /dev/null "$health_url"; then
      [[ "${PM2_SAVE_AFTER_HEALTH:-true}" == "true" ]] && pm2 save
      echo "Legacy PM2 deploy health check passed: $health_url"
      return 0
    fi
    if ((attempt < attempts)); then sleep "$interval"; fi
  done

  echo "Legacy PM2 deploy health check failed: $health_url" >&2
  return 1
}

if [[ -z "$COMMAND" && -z "$APP_ROOT" && -f "$SCRIPT_DIR/server.js" && -f "$SCRIPT_DIR/ecosystem.config.cjs" ]]; then
  cd "$SCRIPT_DIR"
  legacy_pm2_deploy
  exit $?
fi

case "$COMMAND" in
  release|rollback) ;;
  *) echo "Usage: bash scripts/deploy.sh <release|rollback> ..." >&2; usage >&2; exit 1 ;;
esac

if [[ -z "$APP_ROOT" ]]; then
  echo "--app-root (or APP_ROOT) is required" >&2
  exit 1
fi

mkdir -p "$APP_ROOT"
APP_ROOT="$(node -e "const fs=require('node:fs');console.log(fs.realpathSync(process.argv[1]))" "$APP_ROOT")"
mkdir -p "$APP_ROOT/releases" "$APP_ROOT/shared"

VARIANT="$(node -e "const fs=require('node:fs');const p='.agents/architecture-source.json';if(!fs.existsSync(p))process.exit(1);const v=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(v.variant||v.architecture||'')" 2>/dev/null || true)"
case "$VARIANT" in
  spa|ssr) ;;
  *) echo "Cannot determine variant from .agents/architecture-source.json" >&2; exit 1 ;;
esac

if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD=(sha256sum)
else
  HASH_CMD=(shasum -a 256)
fi

# 跨平台解析软链目标；readlink -f 在 BSD/macOS 不可用。
resolve_link() {
  node -e "const fs=require('node:fs');console.log(fs.realpathSync(process.argv[1]))" "$1"
}

atomic_link() {
  local target="$1" link="$2" tmp="$3"
  rm -f "$tmp"
  ln -s "$target" "$tmp"
  if mv -Tf "$tmp" "$link" 2>/dev/null; then
    return 0
  fi
  # BSD mv 没有 -T；回退到 ln -sfn（非严格原子，但等效可用）。
  rm -f "$tmp"
  ln -sfn "$target" "$link"
}

verify_checksums() {
  local dir="$1"
  [[ "$SKIP_VERIFY" == "true" ]] && return 0
  [[ -f "$dir/SHA256SUMS" ]] || { echo "Missing SHA256SUMS in $dir" >&2; return 1; }
  (cd "$dir" && "${HASH_CMD[@]}" -c SHA256SUMS >/dev/null)
}

health_check() {
  if [[ -z "$HEALTH_URL" ]]; then
    echo "WARN: --health-url not set; skipping HTTP health check" >&2
    return 0
  fi
  command -v curl >/dev/null 2>&1 || { echo "curl is required for health check" >&2; return 1; }

  local attempt
  for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1)); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    if ((attempt < HEALTH_ATTEMPTS)); then
      sleep "$HEALTH_INTERVAL"
    fi
  done

  return 1
}

reload_app() {
  local release_dir="$1"
  [[ "$NO_RELOAD" == "true" ]] && return 0

  if [[ "$VARIANT" == "ssr" ]]; then
    (cd "$release_dir" && pm2 startOrReload ecosystem.config.cjs --update-env)
  else
    nginx -t
    nginx -s reload
  fi
}

# CDN 刷新必须指向版本端点；失败时返回非 0，让流水线重试或人工处理。
purge_cdn() {
  local release_id="$1"
  [[ -z "$CDN_PURGE_CMD" ]] && return 0

  echo "Purging CDN cache for release $release_id"
  if ! RELEASE_ID="$release_id" APP_ROOT="$APP_ROOT" HEALTH_URL="$HEALTH_URL" bash -c "$CDN_PURGE_CMD"; then
    echo "CDN purge failed; version endpoint may stay stale" >&2
    return 1
  fi
}

# 防并发发布：优先 flock，没有则用 mkdir 锁。
if command -v flock >/dev/null 2>&1; then
  exec 9>"$APP_ROOT/.deploy.lock"
  flock -n 9 || { echo "another deploy is running" >&2; exit 1; }
else
  LOCK_DIR="$APP_ROOT/.deploy.lock"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "another deploy is running (remove $LOCK_DIR if stale)" >&2
    exit 1
  fi
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
fi

CURRENT_LINK="$APP_ROOT/current"
PREVIOUS_LINK="$APP_ROOT/previous"

if [[ "$COMMAND" == "release" ]]; then
  [[ -n "$RELEASE_ID" ]] || { echo "--release-id is required for release" >&2; exit 1; }

  RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"

  if [[ -e "$RELEASE_DIR" ]]; then
    # 云效回滚会重新执行历史部署脚本；同一 release-id 可能已存在。
    # 复用前必须校验目录内容；即使没有 --artifact，也可以只切 current。
    echo "Release $RELEASE_ID already exists; verifying and reusing it"
    verify_checksums "$RELEASE_DIR"
  else
    [[ -n "$ARTIFACT" ]] || { echo "--artifact is required when releases/$RELEASE_ID does not exist" >&2; exit 1; }
    [[ -e "$ARTIFACT" ]] || { echo "artifact not found: $ARTIFACT" >&2; exit 1; }
    mkdir -p "$RELEASE_DIR"
    if [[ -d "$ARTIFACT" ]]; then
      cp -a "$ARTIFACT/." "$RELEASE_DIR/"
    else
      tar -xzf "$ARTIFACT" -C "$RELEASE_DIR"
    fi
    verify_checksums "$RELEASE_DIR"
  fi

  CURRENT_BEFORE=""
  if [[ -L "$CURRENT_LINK" ]]; then
    CURRENT_BEFORE="$(resolve_link "$CURRENT_LINK")"
  fi

  atomic_link "releases/$RELEASE_ID" "$CURRENT_LINK" "$APP_ROOT/.current.tmp"

  # SSR 要先启动新进程再探活；SPA 切软链后 Nginx 已能读到新文件。
  if [[ "$VARIANT" == "ssr" ]]; then
    reload_app "$RELEASE_DIR"
  fi

  if ! health_check; then
    echo "health check failed; rolling back" >&2
    if [[ -n "$CURRENT_BEFORE" ]]; then
      atomic_link "releases/$(basename "$CURRENT_BEFORE")" "$CURRENT_LINK" "$APP_ROOT/.current.tmp"
      reload_app "$CURRENT_BEFORE"
    else
      rm -f "$CURRENT_LINK"
    fi
    exit 1
  fi

  if [[ "$VARIANT" == "spa" ]]; then
    reload_app "$RELEASE_DIR"
  fi

  if [[ -n "$CURRENT_BEFORE" && "$(basename "$CURRENT_BEFORE")" != "$RELEASE_ID" ]]; then
    atomic_link "releases/$(basename "$CURRENT_BEFORE")" "$PREVIOUS_LINK" "$APP_ROOT/.previous.tmp"
  fi

  if ! purge_cdn "$RELEASE_ID"; then
    exit 1
  fi

  echo "Released $RELEASE_ID to $CURRENT_LINK"
  exit 0
fi

# rollback
if [[ -n "$TARGET_RELEASE" ]]; then
  TARGET_DIR="$APP_ROOT/releases/$TARGET_RELEASE"
else
  [[ -L "$PREVIOUS_LINK" ]] || { echo "no previous release; pass --to <id>" >&2; exit 1; }
  TARGET_DIR="$(resolve_link "$PREVIOUS_LINK")"
  TARGET_RELEASE="$(basename "$TARGET_DIR")"
fi
[[ -d "$TARGET_DIR" ]] || { echo "release not found: $TARGET_DIR" >&2; exit 1; }

CURRENT_BEFORE=""
if [[ -L "$CURRENT_LINK" ]]; then
  CURRENT_BEFORE="$(resolve_link "$CURRENT_LINK")"
fi

atomic_link "releases/$TARGET_RELEASE" "$CURRENT_LINK" "$APP_ROOT/.current.tmp"
reload_app "$TARGET_DIR"

if ! health_check; then
  echo "rollback health check failed" >&2
  if [[ -n "$CURRENT_BEFORE" ]]; then
    atomic_link "releases/$(basename "$CURRENT_BEFORE")" "$CURRENT_LINK" "$APP_ROOT/.current.tmp"
    reload_app "$CURRENT_BEFORE"
  fi
  exit 1
fi

if [[ -n "$CURRENT_BEFORE" ]]; then
  atomic_link "releases/$(basename "$CURRENT_BEFORE")" "$PREVIOUS_LINK" "$APP_ROOT/.previous.tmp"
fi

if ! purge_cdn "$TARGET_RELEASE"; then
  exit 1
fi

echo "Rolled back to $TARGET_RELEASE"
