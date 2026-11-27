#!/usr/bin/env bash
# 安装 Playwright Chromium（a11y / 视觉回归本地用）。
#
# 国内网络默认走 npmmirror，避免 playwright CDN 拉不下来；需要官方源或私有镜像时用
# PLAYWRIGHT_DOWNLOAD_HOST 覆盖。CI 不需要这个脚本：GitHub runner 直连官方源即可。
set -euo pipefail

export PLAYWRIGHT_DOWNLOAD_HOST="${PLAYWRIGHT_DOWNLOAD_HOST:-https://cdn.npmmirror.com/binaries/playwright}"

echo "使用浏览器下载源：${PLAYWRIGHT_DOWNLOAD_HOST}"

if [ "$(uname -s)" = 'Linux' ]; then
  # Linux 需要系统依赖（libnss3 等）；容器 / CI 里是 root，本地会走 sudo。
  pnpm exec playwright install --with-deps chromium
else
  pnpm exec playwright install chromium
fi
