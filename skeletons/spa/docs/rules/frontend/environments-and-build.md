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

## Environments And Build（SPA 变体）

### 3.1 SPA（Vite，`--mode` 原生加载 `.env.<env>`）

```jsonc
{
  "dev": "pnpm dev:mock",
  "dev:mock": "concurrently -k -n mock,vite -c magenta,green \"pnpm mock:dev\" \"node --env-file=.env.mock scripts/start-vite-mock.mjs\"",
  "dev:dev": "vite --host 127.0.0.1 --mode dev",
  "dev:test": "vite --host 127.0.0.1 --mode test",
  "mock:dev": "node --env-file=.env.mock scripts/start-prism-mock.mjs",
  "build:dev": "pnpm typecheck && node scripts/run-vite-with-env.mjs .env.dev build --mode dev",
  "build:test": "pnpm typecheck && node scripts/run-vite-with-env.mjs .env.test build --mode test",
  "build:prod": "pnpm typecheck && node scripts/run-vite-with-env.mjs .env.prod build --mode prod",
  "preview": "vite preview",
}
```

- SPA 的 `VITE_*` 在 build 时烤进产物 → **每环境一份构建产物**（`build:test` / `build:prod`），
  不存在“一份产物多环境”。
- `build:<env>` 必须经 `scripts/run-vite-with-env.mjs` 加载 `.env.<env>` 并生成一次 release ID；直接
  调 `vite build` 会绕过 release ID 和 base path 注入。
- **不引入运行时 `config.json` 注入**：公共配置一律走构建期 `.env.<env>`，按环境分别构建。

## Base Path

`VITE_APP_BASE_PATH` 是以下位置的共同事实：

- Vite `base`
- React Router `basename`
- `version.json` 中的 `basePath`
- Nginx `location`

值必须是 `/` 或 `/<project-id>/`。任何一处不一致都会造成入口可访问但 assets、deep link 或路由无法
匹配。

## Release ID

生产构建优先读取 CI/CD 注入的 `VITE_DEPLOYMENT_VERSION`；未注入时由 `run-vite-with-env.mjs` 生成：

```text
APP_ENV-Git短SHA-UTC构建时间
```

release ID 在一次构建内保持不变，并同时写入浏览器 bundle 与 `dist/version.json`。不得在进程启动或
请求处理中重新生成。

## 静态产物

```text
dist/
  index.html
  version.json
  assets/
```

`dist/` 是 Vite 直接生成的完整静态产物，不做二次封装。`.env.*`、源码、测试、部署脚本和
开发依赖不进入 `dist/`。
