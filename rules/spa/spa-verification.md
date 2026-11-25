# SPA 验证清单

## 静态门禁

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm mock:check
pnpm test
```

## 构建产物

```bash
pnpm env:init prod   # 本地缺少 .env.prod 时
pnpm build:prod
test -f dist/index.html
test -f dist/version.json
test -d dist/assets
bash -n scripts/deploy.sh
```

必须确认：

- Vite 直接生成 `dist/`，不存在二次发布包封装
- 发布系统将完整 `dist/` 部署到 Nginx 静态目录
- `deploy.sh` 只执行 `nginx -t && nginx -s reload`
- Nginx 配置中的 deep link 返回 `index.html`
- `version.json` 返回当前 release ID
- `index.html` 与版本文件为 `no-store`
- hash assets 为 immutable
- API 请求代理到明确的后端 upstream
- base path 外请求不命中当前应用 fallback
- 多标签页在版本二次确认后刷新
