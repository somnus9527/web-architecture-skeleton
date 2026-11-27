#!/usr/bin/env bash
# 在固定 Linux 环境（node:24-bookworm + 官方 Chromium）生成或校验关键页截图基线。
#
# 用法：
#   bash scripts/run-visual.sh            # 校验（CI 同款）
#   bash scripts/run-visual.sh --update   # 重新生成基线并写回仓库
#
# 为什么不直接在本机跑：截图对字体与渲染敏感，macOS 与 Linux 基线不通用。
set -euo pipefail

skeleton_dir="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d /tmp/web-skeleton-visual-XXXXXX)"
mode="${1:-}"

cleanup() {
  rm -rf "$work"
}
trap cleanup EXIT

# 复制源码时排除本机 node_modules / 构建产物，避免污染容器。
tar -cf - \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.next \
  --exclude=test-results \
  --exclude='*.tsbuildinfo' \
  -C "$skeleton_dir" . | tar -xf - -C "$work"

runner=(
  docker run --rm
  -v "$work:/work"
  -w /work
  -e PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright
  node:24-bookworm
)

"${runner[@]}" sh -c '
  echo "Acquire::Retries \"10\";" > /etc/apt/apt.conf.d/80retries
  corepack enable >/dev/null 2>&1
  corepack prepare pnpm@12.4.1 --activate >/dev/null 2>&1
  pnpm install --frozen-lockfile
  for attempt in 1 2 3; do
    pnpm exec playwright install --with-deps chromium && break
    sleep 10
  done
  pnpm exec playwright test --config playwright.visual.config.ts '"${mode:+--update-snapshots}"'
'

if [ "$mode" = "--update" ]; then
  mkdir -p "$skeleton_dir/e2e/visual/pages.visual.ts-snapshots"
  cp "$work"/e2e/visual/pages.visual.ts-snapshots/*-linux.png "$skeleton_dir/e2e/visual/pages.visual.ts-snapshots/"
  echo "基线已写回：e2e/visual/pages.visual.ts-snapshots/*-linux.png"
fi
