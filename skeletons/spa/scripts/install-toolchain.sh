#!/usr/bin/env bash
# 安装并校验工具链版本。
#
# 版本唯一来源：Node 取仓库根 .nvmrc，pnpm 取 package.json 的 packageManager。
# 禁止用 `npm i -g pnpm` 裸装：npm 的 latest tag 会漂，历史上装出过 pnpm 7，
# 而 pnpm 7 既不认识 packageManager 字段，也读不了新版锁文件，装错不会当场失败。
#
# 用法：bash scripts/install-toolchain.sh [--check]
#   --check  只校验，不安装（CI、排查时用）

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHECK_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=true ;;
    -h | --help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "未知参数：$arg（只支持 --check）" >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "✗ $*" >&2
  exit 1
}

# ---- Node ----
[ -f .nvmrc ] || fail "缺少 .nvmrc：Node 版本必须在仓库根声明"
NODE_MAJOR="$(tr -d 'v \r\n' < .nvmrc)"
[ -n "$NODE_MAJOR" ] || fail ".nvmrc 为空"

command -v node >/dev/null 2>&1 || fail "未安装 Node，先装 Node ${NODE_MAJOR}.x（nvm install ${NODE_MAJOR}）"

CURRENT_NODE="$(node -v | sed 's/^v//')"
CURRENT_MAJOR="${CURRENT_NODE%%.*}"
if [ "$CURRENT_MAJOR" != "$NODE_MAJOR" ]; then
  fail "Node 版本不符：.nvmrc 要求 ${NODE_MAJOR}.x，当前 ${CURRENT_NODE}。先 nvm install ${NODE_MAJOR} && nvm use ${NODE_MAJOR}"
fi
echo "✓ Node ${CURRENT_NODE}（.nvmrc 要求 ${NODE_MAJOR}.x）"

# ---- pnpm ----
[ -f package.json ] || fail "缺少 package.json"
POLICY="$(node -p "require('./package.json').packageManager || ''")"
case "$POLICY" in
  pnpm@*) ;;
  '') fail "package.json 缺少 packageManager 字段；pnpm 版本必须以 pnpm@<精确版本> 声明" ;;
  *) fail "packageManager 只支持 pnpm，当前为 ${POLICY}" ;;
esac
PNPM_VERSION="${POLICY#pnpm@}"
echo "$PNPM_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' || fail "packageManager 必须写精确版本（当前 ${POLICY}）"

INSTALLED="$(pnpm --version 2>/dev/null || true)"
if [ "$INSTALLED" = "$PNPM_VERSION" ]; then
  echo "✓ pnpm ${PNPM_VERSION}"
  exit 0
fi

if [ "$CHECK_ONLY" = true ]; then
  fail "pnpm 版本不符：packageManager 要求 ${PNPM_VERSION}，当前 ${INSTALLED:-未安装}"
fi

command -v npm >/dev/null 2>&1 || fail "未找到 npm，无法安装 pnpm ${PNPM_VERSION}"
echo "… 安装 pnpm ${PNPM_VERSION}（当前 ${INSTALLED:-未安装}）"
# 精确版本，不用 latest：latest tag 会漂，装错版本不会当场报错。
npm install -g "pnpm@${PNPM_VERSION}" >/dev/null 2>&1 || fail "安装 pnpm ${PNPM_VERSION} 失败，检查 npm registry 可用性"

ACTUAL="$(pnpm --version 2>/dev/null || true)"
[ "$ACTUAL" = "$PNPM_VERSION" ] || fail "安装后版本仍不符：期望 ${PNPM_VERSION}，实际 ${ACTUAL:-未安装}（检查 PATH 里是否有旧版 pnpm 抢先）"
echo "✓ pnpm ${ACTUAL}"
