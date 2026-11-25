# Environments And Build(环境与构建)

> Scope:SPA(Vite)与 SSR(Next App Router)通用基线。定义环境模型、`.env.*` 文件集、
> pnpm 脚本矩阵、构建期 vs 运行期边界、服务端产物与启动。配置的「读取与校验」边界由各变体的
> config 层负责，本文只定义环境模型与脚本契约。
>
> 本文集中并固化"环境 + 脚本 + 构建"基线;[`./mock-and-integration.md`](./mock-and-integration.md) 的
> _Env Scripts_ 段以本文为准(本文为硬基线,非 "should")。

## 1. 环境模型(唯一选择器:APP_ENV)

- 四个标准环境:`mock` / `dev` / `test` / `prod`。
- 统一用显式 `APP_ENV ∈ {mock,dev,test,prod}` 选择环境,**与框架 `NODE_ENV` 解耦**
  (`NODE_ENV` 只表达 development/production,不用它区分 dev/test/prod 业务环境)。
- 每个 `.env.<env>` 必须自带 `APP_ENV=<env>`;**不要**在 `.env.*` 写 `NODE_ENV`(由框架管理)。
- 语义:`mock`=Prism/OpenAPI;`dev`/`test`=各自后端;`prod`=生产。

## 2. `.env.*` 文件集(必须生成,硬基线)

脚手架 / 初始化**必须**产出:

- `.env.example`:**全量 key + 占位/说明**,提交进仓库,作为配置契约清单。
- `.env.mock`:本地 mock(可提交,只放本地 demo 值;**禁真实凭证 / 生产 token**)。
- `.env.dev` / `.env.test` / `.env.prod`:各环境差异值;**不提交**。
- `.gitignore` 必含:`.env`、`.env.local`、`.env.*.local`,以及含凭证的 `.env.dev/.env.test/.env.prod`
  (`.env.example`、`.env.mock` 除外)。

> 红线:业务代码禁止散落 `process.env.X` / `import.meta.env.X`;统一经 config accessor 读取
> (SPA:`src/shared/config`;SSR:`src/shared/config` + `src/bff/shared/config`)。

## 3. pnpm 脚本矩阵(对称、构建期必须带 env 加载)

通用:`mock:serve`(Prism)、`mock:check`(OpenAPI 校验)、`typecheck`、`lint`、`test`。

## 4. 启动必须加载并校验 env(fail-fast)

- 禁止缺少明确配置来源就直接启动:dev / build 经 `.env.<env>` 加载;生产 start 仅使用 PM2、部署平台或 secret manager 注入的进程环境,不依赖未随产物发布的 `.env.prod`。
- 服务端启动做 runtime validation(Zod / envalid 等),缺关键 key **启动即失败**,不在请求中途才发现;
  SSR 的配置读取与校验细则见变体补段。客户端 public config 单独 schema。

## 5. 构建产物与部署

按变体不同，见文末补段：SPA 的 `dist/` 静态产物，SSR 的 standalone 输出、Server Action 稳定性与发版刷新。

## 6. 验证(✅ 可机械门禁 / ⚠️ 人审)

- ✅ `.env.example` 存在,key 与脚本矩阵自洽;`.env` 及凭证类 `.env.*` 已进 `.gitignore`。
- ✅ 脚本矩阵存在,且 `dev:<env>` / `build:<env>` 经统一入口加载对应 `.env.<env>`（`run-vite-with-env` / `run-next-with-env` 或等价脚本）。
- ✅ 启用自动刷新时：标准构建入口可生成或取得合法 `releaseId`，同一产物内版本一致，版本端点为
  `no-store`，客户端有二次确认和同版本防循环。
- ⚠️ key 是否真跨实例一致、运行时 secret 注入是否到位 → 交付证据 + 人审 / ops。

## 7. Handoff 必含

- 各环境启动 / 构建命令(`mock → pnpm dev:mock`、`test → pnpm build:test` 等),及当前运行的是哪个。
- `.env.*` key 清单、敏感级别、build-time vs runtime 注入方式。
- 发版刷新：release id 的生成或注入方式、构建日志定位方式、多实例一致性边界、版本端点、缓存头、
  检测周期、二次确认、发布后公网验证与回滚边界。

## 本地 env 生命周期

`.gitignore` 使用 `.env*` 通配加显式白名单：`!.env.example`、`!.env.mock`、`!.env.*.example`。
真实取值永不入库；新克隆通过 `pnpm env:init <env>` 从对应模板生成。

已被跟踪的 env 文件，`gitignore` 不再生效，必须显式移除：

```bash
git rm --cached .env.dev .env.prod .env.test
```

删除跟踪不等于删除历史：文件曾被推送就必须按密钥处理，先轮换再评估是否清理历史。

## Environments And Build（SSR 变体）

### 3.2 SSR（Next 无 `--mode`，经统一入口加载 `.env.<env>`）

```jsonc
{
  "dev": "pnpm dev:mock",
  "dev:mock": "concurrently -k \"pnpm mock:serve\" \"node scripts/run-next-with-env.mjs .env.mock dev -H 127.0.0.1\"",
  "dev:dev": "node scripts/run-next-with-env.mjs .env.dev dev -H 127.0.0.1",
  "dev:test": "node scripts/run-next-with-env.mjs .env.test dev -H 127.0.0.1",
  "build:dev": "node scripts/run-next-with-env.mjs .env.dev build --webpack && node scripts/copy-standalone-assets.mjs",
  "build:test": "node scripts/run-next-with-env.mjs .env.test build --webpack && node scripts/copy-standalone-assets.mjs",
  "build:prod": "node scripts/run-next-with-env.mjs .env.prod build --webpack && node scripts/copy-standalone-assets.mjs",
  "build:dist": "pnpm build:dist:prod",
  "build:dist:dev": "pnpm build:dev && node scripts/package-pm2-dist.mjs",
  "build:dist:test": "pnpm build:test && node scripts/package-pm2-dist.mjs",
  "build:dist:prod": "pnpm build:prod && node scripts/package-pm2-dist.mjs",
  "start:prod": "node .next/standalone/server.js",
}
```

- **铁律：SSR 每个 `build:<env>` 必须在构建时加载对应 `.env.<env>`**。原因：`NEXT_PUBLIC_*` 与
  Server Action 加密 key 在 **build 时**烤进产物，且发布模型为「按环境覆盖 + 重启」→ 每环境一份构建。
- Next 没有 Vite 的 `--mode`；统一经 `scripts/run-next-with-env.mjs` 加载 `.env.<env>`，由它生成或
  校验一次 `NEXT_DEPLOYMENT_ID` 后再调用 Next，不能绕过入口直接 `next build`。
- 构建脚本显式使用 `next build --webpack`，保证当前 Next 主版本下的生产构建器稳定且可重复；开发脚本
  仍可使用默认 Turbopack。
- 纯服务端 secret（后端 token、签名密钥）可不写进 `.env.<env>`，改由 PM2 / 平台运行时注入；
  其余 build-time 值由 `.env.<env>` 或 CI / 云效构建环境变量提供。两者并存，但**每环境构建是基线**。

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
  PM2 `startOrReload` 和健康探测；探测成功后执行 `pm2 save`。
- 部署脚本不得执行 Nginx reload，不得固定服务器发布路径，也不得在每次发布前默认 `pm2 delete`。

参考实现 `scripts/copy-standalone-assets.mjs`:

```js
import { cpSync, existsSync } from 'node:fs';

/** 将 standalone 默认不打入的静态资源拷进自包含目录(无 CDN,由 Node 服务自伺服)。 */
const pairs = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
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
