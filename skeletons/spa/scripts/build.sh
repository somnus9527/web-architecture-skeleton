#!/usr/bin/env bash
#
# 构建不可变前端制品。默认执行门禁、类型检查、lint、测试和项目构建。
#
# 用法：
#   bash scripts/build.sh [--env prod|test|dev] [--out dist] [--artifact path.tar.gz]
#                         [--release-id <id>] [--skip-checks]
#
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_NAME=prod
OUT_DIR=dist
ARTIFACT=""
RELEASE_ID=""
SKIP_CHECKS=false

usage() {
  cat <<'USAGE'
Usage: bash scripts/build.sh [options]

Options:
  --env <prod|test|dev>       Build environment (default: prod)
  --out <dir>                 Build output directory (default: dist)
  --artifact <path>           Tarball path (default: <variant>-<release-id>.tar.gz)
  --release-id <id>           Release id embedded in build metadata
  --skip-checks               Skip gates/security/typecheck/lint/test
  -h, --help                  Show this help

The script does not run pnpm install; CI must install dependencies first.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="${2:?--env requires a value}"; shift 2 ;;
    --out) OUT_DIR="${2:?--out requires a value}"; shift 2 ;;
    --artifact) ARTIFACT="${2:?--artifact requires a value}"; shift 2 ;;
    --release-id) RELEASE_ID="${2:?--release-id requires a value}"; shift 2 ;;
    --skip-checks) SKIP_CHECKS=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$ENV_NAME" in
  prod|test|dev) ;;
  *) echo "--env must be prod, test or dev" >&2; exit 1 ;;
esac

VARIANT="$(node -e "const fs=require('node:fs');const p='.agents/architecture-source.json';const v=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(v.variant||v.architecture||'')")"
case "$VARIANT" in
  spa|ssr) ;;
  *) echo "Unsupported variant: ${VARIANT:-<missing>}" >&2; exit 1 ;;
esac

GIT_SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || echo no-git)"
BUILD_TIME="$(date -u +%Y%m%d%H%M%S)"
RELEASE_ID="${RELEASE_ID:-${ENV_NAME}-${GIT_SHA}-${BUILD_TIME}}"
OUT_DIR="${OUT_DIR%/}"
ARTIFACT="${ARTIFACT:-${ROOT_DIR}/${VARIANT}-${RELEASE_ID}.tar.gz}"

if [[ "$SKIP_CHECKS" != "true" ]]; then
  pnpm check:gates
  pnpm check:security
  pnpm typecheck
  pnpm lint
  pnpm test
fi

# 让构建脚本生成的 version.json / release id 与制品元数据使用同一个值。
export VITE_DEPLOYMENT_VERSION="$RELEASE_ID"
export NEXT_DEPLOYMENT_ID="$RELEASE_ID"

if [[ "$VARIANT" == "spa" ]]; then
  pnpm "build:${ENV_NAME}"
  test -f "$OUT_DIR/index.html"
  test -f "$OUT_DIR/version.json"
else
  pnpm "build:dist:${ENV_NAME}"
  test -f "$OUT_DIR/server.js"
  test -f "$OUT_DIR/ecosystem.config.cjs"
  test -d "$OUT_DIR/.next"
fi

cat > "$OUT_DIR/build-meta.json" <<META
{
  "releaseId": "${RELEASE_ID}",
  "variant": "${VARIANT}",
  "env": "${ENV_NAME}",
  "gitSha": "${GIT_SHA}",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
META

if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD=(sha256sum)
else
  HASH_CMD=(shasum -a 256)
fi

(
  cd "$OUT_DIR"
  find . -type f ! -name SHA256SUMS -exec "${HASH_CMD[@]}" {} + | sort -k2 > SHA256SUMS
)

mkdir -p "$(dirname -- "$ARTIFACT")"
tar -czf "$ARTIFACT" -C "$OUT_DIR" .

echo "Built ${VARIANT} ${RELEASE_ID}"
echo "  output:   ${OUT_DIR}/"
echo "  artifact: ${ARTIFACT}"
