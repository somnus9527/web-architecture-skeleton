# PM2 发布交接

正式应用交接时必须填写：

| Item              | Value                             |
| ----------------- | --------------------------------- |
| PM2 app name      | `<project-id>-web`                |
| Working directory | `<release-root>/dist`             |
| Deploy entry      | `bash deploy.sh`                  |
| Entry             | `server.js`                       |
| Hostname          | `0.0.0.0`                         |
| Port              | `<port>`                          |
| Log directory     | `/data/logs/<project-id>-web`     |
| Env source        | 平台变量组 / secret manager / PM2 |
| Log rotation      | `<platform-or-logrotate-policy>`  |
| Health endpoint   | `/<project-id>-api/health`        |
| Release identity  | Git SHA + UTC build time          |
| Paired backend    | `<backend-root>` 或 `N/A`         |
| PM2 save gate     | `<health-only-or-full-smoke>`     |

生产密钥不得随 `dist/` 发布包传输。`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 在构建和运行阶段必须一致，并在同一环境的多实例之间保持一致。

## 部署脚本变量

| Variable                | Default                     |
| ----------------------- | --------------------------- |
| `PROJECT_ID`            | `<project-id>`              |
| `PM2_APP_NAME`          | `<project-id>-web`          |
| `PM2_LOG_DIRECTORY`     | `/data/logs/<pm2-app-name>` |
| `PORT`                  | `3001`                      |
| `PM2_ENV_ALLOWLIST`     | 空                          |
| `PM2_SAVE_AFTER_HEALTH` | `true`                      |

`deploy.sh` 在 PM2 启动前创建日志目录。模板不执行 `sudo`、`chown` 或宽泛 `chmod`；服务器目录
权限由运维预先配置。

标准顺序为：

```text
派生 PM2 名称和日志目录
  -> 创建日志目录
  -> pm2 startOrReload
  -> health/readiness
  -> release smoke
  -> pm2 save
```

脚本默认不执行 `pm2 delete`，避免主动中断现有进程。health 成功后默认自动 `pm2 save`；需要人工确认
时把 `PM2_SAVE_AFTER_HEALTH` 设为 `false`，由流水线在完成全部发布检查后显式执行。version、Nginx
检查与 reload 不属于部署脚本职责。
