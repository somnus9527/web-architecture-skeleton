# 软链发布手册

> 线上应急时先看 [`rollback-quick-reference.md`](./rollback-quick-reference.md)，一页纸列出各模型服务器命令。

适用于服务器允许创建/切换软链的场景。软链让 `deploy.sh` 可以完整处理“发布 + 回滚”，不需要手工改 Nginx 配置；回滚也可以由脚本自动完成。

发布根目录可配置：`--app-root /var/www/<app>` 或环境变量 `APP_ROOT`，`--release-root` 是同一参数的别名。整个流程只需要 `tar`、`cp`、`mv`、`ln`、`find`、`sha256sum`/`shasum` 和 `curl`，**不依赖 `rsync`**。

`release` 的 `--artifact` 只在 `releases/<id>` 不存在时需要；如果目录已存在，可以只传 `--release-id`，脚本校验 `SHA256SUMS` 后直接切 `current`。这正好覆盖云效回滚“重跑历史脚本”的场景。

## 1. 目录布局

```text
/var/www/<app>/                 # SPA；SSR 换成 /opt/<app>
  releases/
    20261126-1030-abc1234/      # 每次发布一个完整制品
    20261126-0900-def5678/
  current -> releases/20261126-1030-abc1234
  previous -> releases/20261126-0900-def5678
  shared/                       # 日志、上传等不随版本删除
  .deploy.lock
```

- `releases/<id>/` 是不可变制品；发布后不再修改。
- `current` 是唯一线上入口；`previous` 只记录上一版，供回滚。
- `shared/` 不参与版本切换；SSR 的日志、上传目录放这里。
- 软链必须是**相对软链**，避免挂载点/迁移后绝对路径失效。

## 2. deploy.sh：发布 + 回滚都由脚本处理

推荐命令接口：

```bash
scripts/deploy.sh release  --app-root /var/www/<app> [--artifact dist] --release-id <id> [--no-reload]
scripts/deploy.sh rollback --app-root /var/www/<app> [--to <id>] [--no-reload]
```

### 2.1 release 流程

```bash
set -Eeuo pipefail

APP_ROOT=/var/www/<app>
RELEASE_ID=${RELEASE_ID:?}
ARTIFACT=${ARTIFACT:?}
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
LOCK=/var/lock/<app>.deploy.lock

umask 022
exec 9>"$LOCK"
flock -n 9 || { echo "another deploy is running" >&2; exit 1; }

# 1. 解包到新 release 目录；不要覆盖已有目录
test ! -e "$RELEASE_DIR" || { echo "release exists: $RELEASE_DIR" >&2; exit 1; }
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARTIFACT" -C "$RELEASE_DIR"
test -f "$RELEASE_DIR/index.html"          # SPA
# test -f "$RELEASE_DIR/server.js"         # SSR
sha256sum -c "$RELEASE_DIR/SHA256SUMS"

# 2. 记录当前版本，准备原子切换
CURRENT_BEFORE=$(readlink -f "$APP_ROOT/current" || true)
rm -f "$APP_ROOT/.current.tmp"
ln -s "releases/$RELEASE_ID" "$APP_ROOT/.current.tmp"
mv -Tf "$APP_ROOT/.current.tmp" "$APP_ROOT/current"

# 3. 健康检查；失败自动回滚到切换前版本
if ! curl -fsS "http://127.0.0.1/<base>/version.json" >/dev/null; then
  if [[ -n "$CURRENT_BEFORE" ]]; then
    rm -f "$APP_ROOT/.current.tmp"
    ln -s "releases/$(basename "$CURRENT_BEFORE")" "$APP_ROOT/.current.tmp"
    mv -Tf "$APP_ROOT/.current.tmp" "$APP_ROOT/current"
  fi
  echo "health check failed, rolled back" >&2
  exit 1
fi

# 4. 更新 previous，保留当前版本
if [[ -n "$CURRENT_BEFORE" ]]; then
  rm -f "$APP_ROOT/.previous.tmp"
  ln -s "releases/$(basename "$CURRENT_BEFORE")" "$APP_ROOT/.previous.tmp"
  mv -Tf "$APP_ROOT/.previous.tmp" "$APP_ROOT/previous"
fi

# 5. SPA 可 reload 让 open_file_cache 立刻失效；SSR 必须 reload/restart
if [[ "${NO_RELOAD:-false}" != "true" ]]; then
  nginx -t && nginx -s reload        # SPA 静态
  # pm2 startOrReload "$RELEASE_DIR/ecosystem.config.cjs" --update-env  # SSR
fi
```

关键点：

- `mv -Tf` 是原子替换软链；不要用 `ln -sfn` 直接覆盖（并发/中断时可能短暂缺失）。
- 先解包、校验，再切 `current`；切之前不要动旧版本。
- 健康检查失败必须自动回滚，不能先 `pm2 save` 或删旧版本。
- `current` 用相对软链；Nginx `root` 指向 `current`。
- SPA 静态切换后 `nginx -s reload` 不是严格必需，但能清 `open_file_cache`，建议保留。
- SSR 必须 `pm2 startOrReload`，因为运行中的 Node 进程不会因为软链切换自动换代码。

### 2.2 rollback 流程

```bash
set -Eeuo pipefail

APP_ROOT=/var/www/<app>
TARGET_ID=${1:-$(basename "$(readlink -f "$APP_ROOT/previous")")}
TARGET_DIR="$APP_ROOT/releases/$TARGET_ID"

test -d "$TARGET_DIR" || { echo "missing release: $TARGET_DIR" >&2; exit 1; }

rm -f "$APP_ROOT/.current.tmp"
ln -s "releases/$TARGET_ID" "$APP_ROOT/.current.tmp"
mv -Tf "$APP_ROOT/.current.tmp" "$APP_ROOT/current"

curl -fsS "http://127.0.0.1/<base>/version.json" >/dev/null

if [[ "${NO_RELOAD:-false}" != "true" ]]; then
  nginx -t && nginx -s reload
  # pm2 startOrReload "$TARGET_DIR/ecosystem.config.cjs" --update-env
fi
```

回滚不需要重新构建；只切软链 + reload/restart。旧 release 和旧 assets 必须还在。

## 3. 手动回滚（脚本不可用时）

只需要三条命令：

```bash
cd /var/www/<app>
rm -f .current.tmp
ln -s releases/<previous-id> .current.tmp
mv -Tf .current.tmp current
nginx -t && nginx -s reload
# SSR: RELEASE_DIR=/opt/<app>/releases/<previous-id> pm2 startOrReload ...
curl -fsS http://127.0.0.1/<base>/version.json
```

手动回滚的风险是选错 release、漏健康检查、漏 PM2 reload；所以优先用 `deploy.sh rollback`，并把“上一版 ID”记录在发布日志里。

## 4. Nginx 与权限

SPA：

```nginx
root /var/www/<app>/current;
location /<base>/ {
  try_files $uri $uri/ /<base>/index.html;
}
```

- Nginx 默认跟随软链；不要启用 `disable_symlinks on`。
- `index.html`/`version.json` 必须 `no-store`；`assets/**` immutable。
- 发布账号只需应用目录写权限；`nginx -t/reload` 没权限时用 `--no-reload`，由运维执行。
- 不要给发布账号 `/etc/nginx` 写权限；配置本身不随版本变。

SSR：

- `ecosystem.config.cjs` 的 `cwd` 指向 `current`，或读取 `RELEASE_DIR`。
- 切 `current` 后必须 `pm2 startOrReload current/ecosystem.config.cjs --update-env`。
- 健康检查通过后再 `pm2 save`；失败回滚 `current` 并重新启动旧版本。

## 5. 保留与清理

- 至少保留 3 个 release；旧 release 保留 7 天或按磁盘策略。
- 清理前确认没有 `current`/`previous` 指向它。
- SPA 的 `assets/` 在 release 目录内，删旧 release 会删旧 assets；如果旧标签页要求可回退，保留更久。
- 清理用 `find releases -maxdepth 1 -type d -mtime +7`，排除 `current`/`previous` 目标。

## 6. 结论

- 走软链时，`deploy.sh` 可以完整处理发布：解包、校验、切 `current`、健康检查、reload/restart。
- 回滚也建议由 `deploy.sh rollback` 处理，不要只靠手工；手工命令很简单，但容易漏健康检查和进程重启。
- 软链模式比“无软链入口替换”更统一：Nginx/PM2 永远指向 `current`，发布和回滚都只切一个指针。
