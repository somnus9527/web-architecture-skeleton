# 回滚一页纸

用于线上出问题时快速判断“云效回滚到底做了什么”和“服务器上要执行什么命令”。

## 0. 先确认云效回滚的类型

| 部署方式               | 云效“回滚”实际做了什么                                               | 服务器要不要操作                                                                                         |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **主机部署**           | 重新下载**历史制品**，并执行**历史版本的部署脚本**；不是简单文件回切 | 看历史部署脚本。脚本只 `cp` 就只回文件；脚本调用 `deploy.sh release/rollback` 才会切软链、reload/restart |
| **OSS / 静态资源部署** | 按历史版本/标签恢复对象，通常不执行服务器命令                        | 一般不需要；刷新 CDN 缓存                                                                                |
| **无构建部署**         | 不支持流水线回滚                                                     | 只能手工处理                                                                                             |

阿里云官方说明（主机部署）：

> 回滚操作的本质是使用历史版本的制品和部署脚本重新执行一次部署任务，并非简单的状态回切。历史部署包仅保留 30 天；回滚会重新下载历史制品并执行历史版本的部署脚本，请确保脚本逻辑支持重复执行。

来源：[云效主机部署](https://help.aliyun.com/zh/yunxiao/user-guide/host-deployment-1)、[如何通过云效进行主机部署](https://help.aliyun.com/zh/yunxiao/use-cases/how-to-deploy-hosts-through-cloud-effect)。

两个关键结论：

1. **不是只回文件，而是重跑历史部署脚本**；但如果那个脚本本身只做文件复制，效果就等同于只回文件。
2. **用的是历史版本的脚本**，不是你现在仓库里的最新 `deploy.sh`。所以旧部署记录的回滚行为由旧脚本决定；新流程上线后要重新跑一次新发布，才有新的回滚记录。

## 1. 最快命令（软链模式，推荐）

### SPA

```bash
APP_ROOT=/var/www/<app> bash scripts/deploy.sh rollback \
  --health-url https://<host>/<base>/version.json
```

指定版本：

```bash
APP_ROOT=/var/www/<app> bash scripts/deploy.sh rollback \
  --to <release-id> \
  --health-url https://<host>/<base>/version.json
```

脚本会：切 `current` → 健康检查 → `nginx -t && nginx -s reload`。失败会自动切回。

### SSR

```bash
APP_ROOT=/opt/<app> bash scripts/deploy.sh rollback \
  --health-url http://127.0.0.1:<port>/<project>-api/health
```

脚本会：切 `current` → `pm2 startOrReload current/ecosystem.config.cjs --update-env` → 健康检查。失败会自动切回并重启旧版本。

## 2. 手工兜底命令

### 2.1 软链 SPA/SSR

```bash
APP_ROOT=/var/www/<app>          # SSR 换成 /opt/<app>
cd "$APP_ROOT"

# 1. 看当前和上一版
readlink -f current
readlink -f previous
ls -lt releases | head

# 2. 切到上一版（或指定 releases/<id>）
rm -f .current.tmp
ln -s releases/<target-id> .current.tmp
mv -Tf .current.tmp current

# 3. SPA reload
nginx -t && nginx -s reload

# 4. SSR 重启（SPA 跳过）
cd "$APP_ROOT/current"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

# 5. 验证
curl -fsS https://<host>/<base>/version.json
curl -fsS http://127.0.0.1:<port>/<project>-api/health
```

没有 GNU `mv -T` 时：

```bash
rm -f .current.tmp
ln -s releases/<target-id> .current.tmp
ln -sfn releases/<target-id> current
```

### 2.2 无软链 SPA：固定目录入口恢复

```bash
APP_ROOT=/var/www/<app>
cd "$APP_ROOT"

cp -a .release/previous/index.html index.html
cp -a .release/previous/version.json version.json

# 固定 root 不需要 reload；如果改过 Nginx 配置，才执行下面两条
# nginx -t && nginx -s reload

curl -fsS https://<host>/<base>/version.json
```

如果切换点是 Nginx 配置里的 `root`：

```bash
cp -a /etc/nginx/app.d/<app>.conf.previous /etc/nginx/app.d/<app>.conf
nginx -t && nginx -s reload
curl -fsS https://<host>/<base>/version.json
```

### 2.3 无软链 SSR：版本目录 + PM2

```bash
TARGET=/opt/<app>/releases/<target-id>
RELEASE_DIR="$TARGET" pm2 startOrReload "$TARGET/ecosystem.config.cjs" --update-env
printf 'RELEASE_DIR=%s\n' "$TARGET" > /opt/<app>/current-release.env
pm2 save
curl -fsS http://127.0.0.1:<port>/<project>-api/health
```

### 2.4 SSR 固定目录：用备份覆盖

```bash
# 前提：发布前做过 backup，例如 /opt/<app>/backups/<old-id>/
cp -a /opt/<app>/backups/<old-id>/. /opt/<app>/current/
pm2 reload <app>-web --update-env
curl -fsS http://127.0.0.1:<port>/<project>-api/health
```

## 3. 回滚前检查

```bash
date -u
readlink -f /var/www/<app>/current      # SSR: /opt/<app>/current
readlink -f /var/www/<app>/previous
ls -lt /var/www/<app>/releases | head
df -h /var/www
curl -I https://<host>/<base>/version.json
```

确认：

- 目标 release 目录还存在，且 `SHA256SUMS` 校验通过。
- 目标版本是“上一稳定版”，不是半小时前刚失败的那版。
- 数据库/后端没有不兼容的 schema 变更；前端回滚不负责数据库回滚。
- 旧 `assets/` 还在；删除旧 release 前确认没有旧标签页仍在使用。

## 4. 回滚后检查

```bash
readlink -f /var/www/<app>/current
curl -fsS https://<host>/<base>/version.json
curl -I https://<host>/<base>/
# SSR
pm2 list
pm2 describe <app>-web
curl -fsS http://127.0.0.1:<port>/<project>-api/health
# 日志
tail -n 100 /data/logs/<app>-web/<app>-web-error.log
```

至少确认：

- `current` 指向目标 release。
- `version.json` 的 release id 是目标版本。
- 首屏/登录/一个核心接口正常。
- SSR 进程 online，健康检查 200。
- 没有新的 5xx/静态资源 404。

## 5. 云效回滚特别注意

1. **部署包只保留 30 天**：超过 30 天，云效无法回滚；只能靠服务器保留的 `releases/` 手工回滚。
2. **回滚用历史部署脚本**：如果旧脚本只把文件复制到固定目录，它不会自动切软链，也不会自动 `pm2 reload`；需要在服务器执行 `deploy.sh rollback` 或手工命令。
3. **回滚可能重跑 `deploy.sh release`**：如果历史 release id 的目录已存在，新的 `deploy.sh release` 会先校验 `SHA256SUMS` 再复用该目录，不会直接失败；这是为了兼容云效“重跑历史脚本”的机制。
4. **回滚不是数据库回滚**：前端只回静态资源/进程；后端 schema、数据迁移、配置开关要单独评估。
5. **OSS/静态部署**：云效回滚的是对象版本，不执行服务器命令；如果 Nginx 还缓存了 `index.html`，需要刷新 CDN/代理缓存。
6. **无构建部署**：云效不支持流水线回滚，只能手工。

## 6. 绝对不要做

- 不要 `rm -rf current` 或 `rm -rf releases/` 来做回滚。
- 不要只 `git revert` 就认为线上已回滚；必须重新构建/部署或切 release。
- 不要只切软链但不 `pm2 reload`（SSR 进程还在跑旧代码）。
- 不要只 `pm2 restart` 但不切 `current`（重启的还是新版本）。
- 不要在未做健康检查前删除旧版本或执行 `pm2 save`。
- 不要把生产 `.env` 打进制品或提交到仓库。

## 7. 一页决策表

| 你的部署方式               | 服务器回滚命令                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| 软链 SPA                   | `APP_ROOT=/var/www/<app> bash scripts/deploy.sh rollback --health-url ...`    |
| 软链 SSR                   | `APP_ROOT=/opt/<app> bash scripts/deploy.sh rollback --health-url ...`        |
| 无软链 SPA 固定入口        | 恢复 `.release/previous/index.html` + `version.json`；固定 root 不需要 reload |
| 无软链 SPA Nginx root 切换 | 恢复 `<app>.conf.previous` → `nginx -t && nginx -s reload`                    |
| 无软链 SSR 版本目录        | `RELEASE_DIR=<old> pm2 startOrReload ...` → 健康检查 → `pm2 save`             |
| 无软链 SSR 固定目录        | 从备份 `cp -a` 覆盖 → `pm2 reload` → 健康检查                                 |
| 云效 OSS/静态部署          | 云效回滚对象版本；刷新 CDN，无需服务器命令                                    |
| 云效无构建部署             | 不支持回滚；手工处理                                                          |

更细的目录布局与失败处理见 [`symlink-release.md`](./symlink-release.md) 和 [`no-symlink-release.md`](./no-symlink-release.md)。

## 8. 只保留 `deploy.sh release` 是否够

**在满足以下条件时，云效回滚可以只靠幂等的 `release`：**

1. 回滚走的是云效**主机部署**，不是 OSS/静态资源或无构建部署。
2. 历史部署脚本确实调用 `deploy.sh release --release-id <旧 id>`，而不是只做 `tar`/`cp`。
3. 该历史部署记录仍在云效 30 天保留期内，历史制品还能下载。
4. 旧 release 目录存在且 `SHA256SUMS` 可校验；或允许 `--skip-verify`。
5. 云效回滚重跑脚本时，`deploy.sh release` 能拿到旧 release id，并且切换 `current`、健康检查、reload/restart 都在脚本里。

满足时，`release` 的幂等分支就是回滚入口：

```bash
# 云效重跑历史脚本时，release-id 已存在
deploy.sh release --app-root ... --artifact ... --release-id <旧 id>
# 也可以不传 artifact，只切已存在的 release 目录
deploy.sh release --app-root ... --release-id <旧 id>
# 校验通过 -> 复用 releases/<旧 id> -> 切 current -> 健康检查 -> reload/restart
```

**同时保留 `deploy.sh rollback` 专门处理回滚场景；它只解析 previous/target，然后走同一个切换/健康检查流程：**

```bash
# 伪代码：rollback = 找到 previous 目录，然后走同一个 activate
target="$(readlink -f "$APP_ROOT/previous")"
deploy.sh release --app-root "$APP_ROOT" --artifact "$target" --release-id "$(basename "$target")"
```

保留它的理由：

- **超过 30 天**：云效历史制品过期，`release` 没有 artifact 可下载；`rollback` 可以直接用服务器上保留的 `releases/<id>`。
- **旧部署记录**：旧脚本可能只 `cp` 文件，不会调用新的 `release`；需要人工执行 `rollback`。
- **云效不可用/权限异常**：服务器侧要有一条不依赖平台的控制面。
- **OSS/静态部署**：没有主机部署脚本，`rollback`/手工命令才是服务器侧入口。
- **脚本本身出问题**：保留一条更短的“切 `current` + 健康检查”路径，便于救火。
- **多主机/分批**：云效回滚可能按主机组分批；服务器侧 `rollback` 更适合精确处理单机异常。

结论：**核心状态机只需要 `release` 幂等；`rollback` 不承载独立逻辑，只做“解析 previous/target → 调用同一个 activate”的薄封装即可。** 不建议把两套切换逻辑各写一遍。
