# Nginx 交接清单

发布前由应用 owner 与运维共同确认：

| 配置                 | 默认占位                      |
| -------------------- | ----------------------------- |
| `VITE_APP_BASE_PATH` | `/<project-id>/` 或 `/`       |
| Nginx static root    | `/var/www/<project-id>`       |
| API location         | `/api/`                       |
| API upstream         | `http://127.0.0.1:<api-port>` |

交接必须提供：

- `pnpm build:prod` 和 `dist/` 制品上传方式
- Nginx static root、location 和 API upstream
- `index.html`、`version.json`、hash assets 的缓存规则
- history fallback 与 API 代理检查命令
- 当前 release ID
- 上一完整 `dist/` 制品及回滚方法

发布平台负责将完整 `dist/` 部署到 Nginx 静态目录。静态文件就位后执行
`bash scripts/deploy.sh`，脚本只包含 Nginx 配置检查和 reload 命令。
