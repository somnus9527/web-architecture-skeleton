## Environments And Build（SSR 变体）

### 3.2 SSR(Next 无 `--mode`,用 `node --env-file=` 显式加载,不引入额外依赖)

```jsonc
{
  "dev": "pnpm dev:mock",
  "dev:mock": "concurrently -k \"pnpm mock:serve\" \"node --env-file=.env.mock node_modules/next/dist/bin/next dev\"",
  "dev:dev": "node --env-file=.env.dev  node_modules/next/dist/bin/next dev",
  "dev:test": "node --env-file=.env.test node_modules/next/dist/bin/next dev",
  "build:dev": "node --env-file=.env.dev  node_modules/next/dist/bin/next build --webpack && node scripts/copy-standalone-assets.mjs",
  "build:test": "node --env-file=.env.test node_modules/next/dist/bin/next build --webpack && node scripts/copy-standalone-assets.mjs",
  "build:prod": "node --env-file=.env.prod node_modules/next/dist/bin/next build --webpack && node scripts/copy-standalone-assets.mjs",
  "build:dist": "pnpm build:dist:prod",
  "build:dist:dev": "pnpm build:dev && node scripts/package-pm2-dist.mjs",
  "build:dist:test": "pnpm build:test && node scripts/package-pm2-dist.mjs",
  "build:dist:prod": "pnpm build:prod && node scripts/package-pm2-dist.mjs",
  "start:prod": "node .next/standalone/server.js",
}
```

- **铁律:SSR 每个 `build:<env>` 必须在构建时加载对应 `.env.<env>`**。原因:`NEXT_PUBLIC_*` 与
  Server Action 加密 key 在 **build 时**烤进产物,且发布模型为「按环境覆盖 + 重启」→ 每环境一份构建。
- Next 无 Vite 的 `--mode`;统一用 `node --env-file=.env.<env>`(Node 20.6+)显式加载,**不引入 `dotenv-cli`**。
- 构建脚本显式使用 `next build --webpack`，保证当前 Next 主版本下的生产构建器稳定且可重复；开发脚本仍可使用默认 Turbopack。
- 纯服务端 secret(后端 token、签名密钥)可不写进 `.env.<env>`,改由 PM2 / 平台运行时注入;
  其余 build-time 值由 `.env.<env>` 或 CI / 云效构建环境变量提供。两者并存,但**每环境构建是基线**。

## 5. SSR 构建产物与部署

### 5.1 输出目录与产物(无 CDN 基线)

- 输出目录保持默认 `.next`(不改 `distDir`);`.next` 进 `.gitignore`。
- `next.config` 必须设 `output: 'standalone'`。
- **因公司无 CDN,build 收尾必须把 `static` 与 `public` 拷进 standalone**(否则线上静态资源 404):
  - `.next/static` → `.next/standalone/.next/static`
  - `public/` → `.next/standalone/public/`
  - 由 `scripts/copy-standalone-assets.mjs` 跨平台拷贝(禁 `cp -r`,Windows 不友好)。
- 启动:`node .next/standalone/server.js`(不再用 `next start`)。
- PM2 发布可由 `scripts/package-pm2-dist.mjs` 生成独立 `dist/` 包:复制 standalone 内容、
  `.next/static`、`public`、`ecosystem.config.cjs` 与根目录 `deploy.sh`;`.env.*` 不进入发布包,
  构建和运行环境变量均由云效、PM2 或平台注入。
- 流水线负责把发布包解压到目标目录，再执行 `bash deploy.sh`。部署脚本统一完成日志目录创建、
  PM2 `startOrReload` 和健康探测；`bff-only` 默认探测成功后 `pm2 save`。`next-backend` 默认不自动
  保存 PM2 状态，必须在 readiness、数据库只读和非破坏性业务 smoke 后由流水线显式保存。
- 部署脚本不得执行 Nginx reload，不得固定服务器发布路径，也不得在每次发布前默认 `pm2 delete`。

参考实现 `scripts/copy-standalone-assets.mjs`:

```js
import { cpSync, existsSync } from "node:fs";

/** 将 standalone 默认不打入的静态资源拷进自包含目录(无 CDN,由 Node 服务自伺服)。 */
const pairs = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
];
for (const [from, to] of pairs) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}
```

### 5.2 Server Action 稳定性(防 "Server Action not found")

> Server Action 的 ID 用一把加密 key 生成,且每次 build 重算;多实例(PM2 cluster)各实例 key 不一致时,
> 表单提交被打到 key 不同的实例 → "action not found"。

项目存在 Server Action(`src/bff/actions/` 内有 `'use server'`)时:

- **必须设 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`**:base64 编码的 AES key(16 / 24 / 32 字节)。
- **build-time 注入,且所有实例、所有构建用同一把 key**(进 `.env.example` 并由各环境注入)。
- 多实例下不固定 key 即会复现该错误;固定后即解。
- key 视为 secret:不提交真实值,只在 `.env.example` 留 key 名 + 说明。

### 5.3 发版版本与自动整页刷新

- `NODE_ENV=development` 不要求 release id，不得因为缺少 `NEXT_DEPLOYMENT_ID` 阻断 `next dev`，
  并且不挂载浏览器版本观察器。
- `next build` 属于 production 构建；SSR/SPA 的受控构建入口必须在框架构建开始前生成或取得一次
  不可变 `releaseId`。
- 单机构建后分发同一份产物时可由构建脚本自动生成；多节点独立构建、滚动发布或灰度发布时，由
  CI/CD、发布平台或统一事实源提供。
- 构建脚本优先使用 CI/CD 已注入的 `NEXT_DEPLOYMENT_ID`；未注入时自动生成一次。该变量不进入
  `.env.mock`、`.env.dev`、`.env.test` 或 `.env.prod`。
- Next 项目将该值用于 `deploymentId`；环境变量只是可选传递方式，不强制使用
  `DEPLOYMENT_VERSION` 等自定义变量名。
- Next `deploymentId`、客户端当前版本和同源版本端点必须使用同一 release id。
- 新增 release id 必填校验时，必须同步完成标准构建脚本、CI/CD 与发布文档接线，确保既有
  `build:<env>` 命令不依赖未配置的外部变量。
- 客户端检测、二次确认、后台暂停、BroadcastChannel、防循环以及 SPA 在线覆盖边界统一见
  [`./frontend-release-refresh.md`](./frontend-release-refresh.md)。
- Server Action encryption key 解决跨实例 Action ID 稳定性；`deploymentId` 与自动整页刷新解决
  新旧客户端/服务端版本偏斜，两者不能互相替代。
