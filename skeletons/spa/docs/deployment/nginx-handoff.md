# Nginx 交接清单

发布前由应用 owner 与运维共同确认：

| 配置                 | 默认占位                                       |
| -------------------- | ---------------------------------------------- |
| `VITE_APP_BASE_PATH` | `/<project-id>/` 或 `/`                        |
| 部署目录（static）   | `/var/www/<project-id>`；Nginx `root /var/www` |
| API location         | `/api/`                                        |
| API upstream         | `http://127.0.0.1:<api-port>`                  |

交接必须提供：

- `pnpm build:prod` 和 `dist/` 制品上传方式
- Nginx static root、location 和 API upstream
- `index.html`、`version.json`、hash assets 的缓存规则
- history fallback 与 API 代理检查命令
- 网关与页面不同域时，`/api/` 必须由 Nginx 同源反代，转发 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto` 并透传 `Set-Cookie`
- 会话 cookie 必须 `HttpOnly`、`Secure`、`SameSite=Lax`；前端不读取 token，也不得回退到 localStorage/Bearer
- 当前 release ID
- 上一完整 `dist/` 制品及回滚方法

发布平台负责将完整 `dist/` 部署到 Nginx 静态目录。静态文件就位后执行
`bash scripts/deploy.sh`，脚本只包含 Nginx 配置检查和 reload 命令。
