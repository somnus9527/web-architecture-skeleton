# Verification

## Always-on

- 验证命令必须从最小相关范围开始，再扩大到全量门禁。
- 不得用放宽测试或关闭规则掩盖实现问题。
- 构建发布改动必须验证 Vite 输出的完整 `dist/` 静态产物。
- 启动本地服务后必须停止并确认端口释放。

## Routing

- 代码改动：至少执行 `pnpm typecheck`、`pnpm lint` 和相关测试。
- 代码改动：增加 `pnpm check:security`；pre-push 默认跑 `pnpm quality:check`（Full，与 CI 同一套，宿主无关）。
- 门禁允许临时降档到 `pnpm verify:push` / `pnpm verify:push:changed`；只要本次实施降过档，交付前必须手动补跑 `pnpm quality:check`。
- 鉴权/会话改动：确认请求只走同源 HttpOnly cookie，响应不含 token，401 清理内存态；不得回退到 localStorage/Bearer。
- API/mock 改动：增加 `pnpm mock:check`。
- 构建发布改动：增加 `pnpm build:prod`、`bash -n scripts/deploy.sh` 和目标环境 HTTP 检查。
- UI 改动：按任务风险增加浏览器截图与交互验证。

## Rule references

- SPA verification: `docs/rules/frontend/spa-verification.md`
- Delivery verification: `docs/rules/frontend/delivery-verification.md`
- Online release: `docs/deployment/online-release.md`
