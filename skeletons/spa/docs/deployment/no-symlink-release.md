# 无软链发布手册

> 线上应急时先看 [`rollback-quick-reference.md`](./rollback-quick-reference.md)，一页纸列出各模型服务器命令。

用于服务器运维不允许使用软链（`ln -s`）的场景。核心原则不变：**制品不可变、切换原子、失败可回滚、旧版本可保留**；只是把“软链切换”换成“文件原子替换”或“配置/进程参数切换”。

## 1. 先判断属于哪种情况

| 场景                                  | 推荐模型                           | 是否需要改 Nginx | 是否需要软链 |
| ------------------------------------- | ---------------------------------- | ---------------- | ------------ |
| SPA，Nginx 固定 `root`，运维不改配置  | 固定目录 + 入口文件原子替换        | 否               | 否           |
| SPA，运维允许写 app include 并 reload | 版本目录 + Nginx `root` 切换       | 是               | 否           |
| SSR，PM2 允许按 release 目录启动      | 版本目录 + PM2 `cwd`/`RELEASE_DIR` | 否               | 否           |
| SSR，PM2 只能固定目录                 | 固定目录 + `cp -a` + `pm2 reload`  | 否               | 否           |

优先推荐 **SPA 固定目录 + 入口原子替换**、**SSR 版本目录 + PM2 `RELEASE_DIR`**；两者都不需要软链，也不需要每次发布改 Nginx。

## 2. SPA：固定目录 + 入口原子替换（推荐）

### 2.1 目录布局

```text
/var/www/<app>/
  index.html                 # 当前入口
  version.json               # 当前版本
  assets/                    # 内容哈希文件，只增不删
  .release/
    20261126-1030-abc1234/
      index.html
      version.json
      build-meta.json
    previous/
      index.html
      version.json
  .deploy.lock
```

- `assets/` 使用 Vite 的内容哈希文件名；新版本只新增文件，不覆盖旧文件。
- `index.html` / `version.json` 是唯一切换点；二者在同一文件系统内 `mv` 才是原子的。
- `.release/<id>/` 保留完整入口备份，便于审计和回滚；不参与线上读取。
- 旧 `assets/` 保留至少 7 天或 3 个版本，防止旧标签页 404。

### 2.2 发布步骤

```bash
set -Eeuo pipefail

APP_ROOT=/var/www/<app>
RELEASE_ID=20261126-1030-abc1234
ARTIFACT=/tmp/<app>-${RELEASE_ID}.tar.gz
LOCK=/var/lock/<app>.deploy.lock

umask 022
exec 9>"$LOCK"
flock -n 9 || { echo "another deploy is running" >&2; exit 1; }

# 1. 解包到同文件系统的临时目录（不能跨文件系统 mv）
rm -rf "$APP_ROOT/.incoming"
mkdir -p "$APP_ROOT/.incoming"
tar -xzf "$ARTIFACT" -C "$APP_ROOT/.incoming"

# 2. 校验制品
test -f "$APP_ROOT/.incoming/index.html"
test -f "$APP_ROOT/.incoming/version.json"
test -f "$APP_ROOT/.incoming/build-meta.json"
sha256sum -c "$APP_ROOT/.incoming/SHA256SUMS"

# 3. 先同步不可变 assets（只增不删）
cp -a "$APP_ROOT/.incoming/assets/." "$APP_ROOT/assets/"

# 4. 保留上一版入口，准备原子替换
mkdir -p "$APP_ROOT/.release/$RELEASE_ID" "$APP_ROOT/.release/previous"
cp -a "$APP_ROOT/index.html" "$APP_ROOT/.release/previous/index.html" 2>/dev/null || true
cp -a "$APP_ROOT/version.json" "$APP_ROOT/.release/previous/version.json" 2>/dev/null || true
cp -a "$APP_ROOT/.incoming/index.html" "$APP_ROOT/.release/$RELEASE_ID/index.html"
cp -a "$APP_ROOT/.incoming/version.json" "$APP_ROOT/.release/$RELEASE_ID/version.json"
cp -a "$APP_ROOT/.incoming/build-meta.json" "$APP_ROOT/.release/$RELEASE_ID/build-meta.json"

# 5. 同目录 mv：原子替换入口
mv "$APP_ROOT/.incoming/index.html" "$APP_ROOT/index.html.new"
mv "$APP_ROOT/.incoming/version.json" "$APP_ROOT/version.json.new"
mv "$APP_ROOT/index.html.new" "$APP_ROOT/index.html"
mv "$APP_ROOT/version.json.new" "$APP_ROOT/version.json"

# 6. 健康检查；失败立即回滚
if ! curl -fsS "http://127.0.0.1/<base>/version.json" >/dev/null; then
  cp -a "$APP_ROOT/.release/previous/index.html" "$APP_ROOT/index.html"
  cp -a "$APP_ROOT/.release/previous/version.json" "$APP_ROOT/version.json"
  echo "health check failed, rolled back" >&2
  exit 1
fi

rm -rf "$APP_ROOT/.incoming"
echo "deployed $RELEASE_ID"
```

### 2.3 回滚

```bash
APP_ROOT=/var/www/<app>
RELEASE_ID=<previous-release-id>

flock -n /var/lock/<app>.deploy.lock bash -c '
  cp -a "$APP_ROOT/.release/'"$RELEASE_ID"'/index.html" "$APP_ROOT/index.html"
  cp -a "$APP_ROOT/.release/'"$RELEASE_ID"'/version.json" "$APP_ROOT/version.json"
'
curl -fsS "http://127.0.0.1/<base>/version.json"
```

回滚只换入口，不删 `assets/`；旧版本引用的 hash 资源仍在。

### 2.4 注意事项

- `mv` 必须发生在**同一文件系统**；先把制品解到 `$APP_ROOT/.incoming`，不要直接从 `/tmp` 跨盘 `mv`。
- 先同步 `assets/`，再换 `index.html`；顺序反了会出现新入口引用不存在的资源。
- `index.html` 和 `version.json` 不是同时原子替换；两者之间有一个极短窗口。对版本一致性要求极高时，把 `version.json` 放在 `index.html` 之前替换，或让前端以 `index.html` 内联的 release id 为准。
- 不要在发布脚本里 `rm -rf assets/`；只做按时间/版本清理，且确认没有旧入口引用。
- 发布账号只需要应用目录写权限和端口探测权限，不需要 root；`nginx -t/reload` 不属于这个模型。

## 3. SPA：版本目录 + Nginx `root` 切换

适用于运维允许维护一个 app include、并允许 `nginx -t && nginx -s reload` 的场景。

```text
/var/www/<app>/releases/<release-id>/   # 完整 dist
/etc/nginx/app.d/<app>.conf             # 只包含 root 与 locations
/etc/nginx/app.d/<app>.conf.previous    # 上一版配置
```

`<app>.conf` 由部署脚本生成，核心是：

```nginx
root /var/www/<app>/releases/<release-id>;
```

切换步骤：

```bash
set -Eeuo pipefail
APP_CONF=/etc/nginx/app.d/<app>.conf
NEXT_CONF=$(mktemp /etc/nginx/app.d/<app>.conf.XXXXXX)
trap 'rm -f "$NEXT_CONF"' EXIT

# 写入新 root 与 location
render_app_conf "<release-id>" > "$NEXT_CONF"

# 保留旧配置，原子替换后再校验；nginx -t 读的是当前配置，不是临时文件
cp -a "$APP_CONF" "$APP_CONF.previous"
mv "$NEXT_CONF" "$APP_CONF"

if ! nginx -t; then
  mv "$APP_CONF.previous" "$APP_CONF"
  nginx -t
  nginx -s reload
  exit 1
fi

nginx -s reload

# 健康检查失败则恢复旧配置
curl -fsS "http://127.0.0.1/<base>/version.json" >/dev/null || {
  mv "$APP_CONF.previous" "$APP_CONF"
  nginx -t
  nginx -s reload
  exit 1
}
```

没有软链，切换点变成“配置文件里的 `root`”；回滚就是把旧配置 `mv` 回来。注意 `nginx -t` 必须紧跟配置替换、先于 `reload`；如果校验失败，先恢复旧配置再 reload。

## 4. SSR：版本目录 + PM2 `RELEASE_DIR`

### 4.1 目录布局

```text
/opt/<app>/
  releases/
    20261126-1030-abc1234/
      server.js
      node_modules/
      .next/
      public/
      ecosystem.config.cjs
      deploy.sh
  shared/                  # 日志、上传等不随版本删除的目录
  current-release.env      # 只记录当前 release 路径，供 PM2 读取
  .deploy.lock
```

### 4.2 ecosystem 读取 release 目录

```js
const releaseDir = process.env.RELEASE_DIR ?? process.cwd();

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME ?? '<app>-web',
      cwd: releaseDir,
      script: 'server.js',
      // ...
    },
  ],
};
```

### 4.3 切换步骤

```bash
set -Eeuo pipefail
RELEASE_ID=20261126-1030-abc1234
RELEASE_DIR=/opt/<app>/releases/$RELEASE_ID
ARTIFACT=/tmp/<app>-$RELEASE_ID.tar.gz

flock -n /var/lock/<app>.deploy.lock bash -c '
  mkdir -p "'"$RELEASE_DIR"'"
  tar -xzf "'"$ARTIFACT"'" -C "'"$RELEASE_DIR"'"
  test -f "'"$RELEASE_DIR"'/server.js"
  test -f "'"$RELEASE_DIR"'/ecosystem.config.cjs"
'

# 先启动新版本，PM2 用 env 指向新目录
RELEASE_DIR="$RELEASE_DIR" pm2 startOrReload "$RELEASE_DIR/ecosystem.config.cjs" --update-env

# 健康检查通过后记录 current-release.env，并 pm2 save
curl -fsS "http://127.0.0.1:${PORT:-3001}/<project>-api/health" >/dev/null
printf 'RELEASE_DIR=%s\n' "$RELEASE_DIR" > /opt/<app>/current-release.env
pm2 save
```

回滚：

```bash
PREVIOUS_DIR=/opt/<app>/releases/<previous-id>
RELEASE_DIR="$PREVIOUS_DIR" pm2 startOrReload "$PREVIOUS_DIR/ecosystem.config.cjs" --update-env
curl -fsS "http://127.0.0.1:${PORT:-3001}/<project>-api/health"
printf 'RELEASE_DIR=%s\n' "$PREVIOUS_DIR" > /opt/<app>/current-release.env
pm2 save
```

### 4.4 如果 PM2 只能固定目录

用 `cp -a` 把新制品覆盖到固定目录，再 `pm2 reload`：

```bash
cp -a /tmp/<app>-new/. /opt/<app>/current/
pm2 reload <app>-web --update-env
curl -fsS "http://127.0.0.1:${PORT:-3001}/<project>-api/health"
```

`cp -a` 不是原子切换，覆盖期间可能短暂混合版本；旧进程在 `pm2 reload` 完成前继续持有旧代码。适合内部系统或低流量场景，公网高并发优先版本目录。

> 这台服务器不需要 `rsync`：发布制品是 `tar.gz`，用 `tar` 解包、`cp` 合并、`mv` 切换即可。

## 5. 运维检查清单

- [ ] 发布账号只拥有应用目录写权限；不默认使用 root。
- [ ] 用 `flock` 防并发发布，锁文件固定。
- [ ] 制品带 `build-meta.json` 与 `SHA256SUMS`，部署前校验。
- [ ] 释放前检查磁盘空间；保留至少 3 个版本。
- [ ] 每次发布记录 release id、git SHA、构建时间、操作人、结果。
- [ ] 健康检查含 `version.json`/`health` 与一个静态资源。
- [ ] 失败回滚有明确命令，且保留上一版入口/配置。
- [ ] Nginx 配置变更必须先 `nginx -t` 再 reload；无权限时用 `--no-reload` 交给运维。
- [ ] 旧 `assets/` 与旧 release 按保留策略清理，不在发布中即时删除。
- [ ] 生产 env/secret 不进入制品，由平台或 secret manager 注入。
- [ ] 日志目录在 release 目录之外，按 logrotate/平台策略保留。

## 6. 常见失败与处理

| 现象                | 原因                                      | 处理                                                        |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| 新入口 404 静态资源 | 先换 `index.html`，后同步 `assets/`       | 按“先 assets 后入口”重做；回滚入口                          |
| 回滚后仍 404        | 旧 assets 被提前清理                      | 恢复保留的 assets 备份；调整保留策略                        |
| `mv` 跨文件系统失败 | 临时目录和 `$APP_ROOT` 不在同一挂载       | 解包到 `$APP_ROOT/.incoming`                                |
| Nginx reload 失败   | 配置语法错/权限不足                       | `nginx -t` 输出为准；恢复 `.previous`；必要时 `--no-reload` |
| PM2 新进程起不来    | release 目录缺 `node_modules`/`.next`/env | 检查制品清单；回滚 `RELEASE_DIR`                            |
| 健康检查偶发失败    | 进程未就绪/端口未监听                     | 增加重试与超时；不要直接 `pm2 save`                         |
| 并发发布互相覆盖    | 没有锁                                    | `flock -n`，失败即退出                                      |

## 7. 推荐结论

- **SPA 优先用固定目录 + 入口原子替换**：不需要软链，不需要每次改 Nginx，回滚只换两个文件。
- **SSR 优先用版本目录 + PM2 `RELEASE_DIR`**：不需要软链，不需要改 Nginx，回滚只切环境变量并重启。
- 只有运维允许维护 app include 时，才用“版本目录 + Nginx `root` 切换”；否则不要为了原子性强行引入软链。
- 三种模型的共同要求都是：不可变制品、同文件系统原子替换、健康检查、保留上一版、并发锁。软链只是其中一种实现，不是发布的前提。
