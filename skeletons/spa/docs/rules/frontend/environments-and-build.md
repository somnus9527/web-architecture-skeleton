# Environments And Build(环境与构建)

> Scope:SPA(Vite)与 SSR(Next App Router)通用基线。定义环境模型、`.env.*` 文件集、
> pnpm 脚本矩阵、构建期 vs 运行期边界、SSR 产物与启动。配置的「读取与校验」边界以
> [`./ssr-runtime-config.md`](./ssr-runtime-config.md) 为准,本文不重复 env 分类细节。
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
- 服务端启动做 runtime validation(Zod / envalid 等),缺关键 key **启动即失败**,不在请求中途才发现
  (细则见 [`./ssr-runtime-config.md`](./ssr-runtime-config.md))。客户端 public config 单独 schema。

## 5. 构建产物与部署

按变体不同，见文末补段：SPA 的 `dist/` 静态产物，SSR 的 standalone 输出、Server Action 稳定性与发版刷新。

## 6. 验证(✅ 可机械门禁 / ⚠️ 人审)

- ✅ `.env.example` 存在,key 与脚本矩阵自洽;`.env` 及凭证类 `.env.*` 已进 `.gitignore`。
- ✅ 脚本矩阵存在,且 `dev:<env>` / `build:<env>` 带 env 加载(SPA `--mode`、SSR `--env-file`)。
- ✅ SSR:`next.config` 含 `output: 'standalone'`;build 脚本含 standalone 资源拷贝;
  存在 Server Action 时 `.env.example` 含 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。
- ✅ 启用自动刷新时：标准构建入口可生成或取得合法 `releaseId`，同一产物内版本一致，版本端点为
  `no-store`，客户端有二次确认和同版本防循环。
- ✅ `next dev` 在未设置 `NEXT_DEPLOYMENT_ID` 时可直接启动，且 development 页面不发起版本轮询。
- ⚠️ key 是否真跨实例一致、运行时 secret 注入是否到位 → 交付证据 + 人审 / ops。

## 7. Handoff 必含

- 各环境启动 / 构建命令(`mock → pnpm dev:mock`、`test → pnpm build:test` 等),及当前运行的是哪个。
- `.env.*` key 清单、敏感级别、build-time vs runtime 注入方式。
- SSR:standalone 启动命令、需拷贝的产物清单、`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 注入方式。
- 发版刷新：release id 的生成或注入方式、构建日志定位方式、多实例一致性边界、版本端点、缓存头、
  检测周期、二次确认、发布后公网验证与回滚边界。

## Environments And Build（SPA 变体）

### 3.1 SPA(Vite,`--mode` 原生加载 `.env.<env>`)

```jsonc
{
  "dev": "pnpm dev:mock",
  "dev:mock": "concurrently -k \"pnpm mock:serve\" \"vite --mode mock\"",
  "dev:dev": "vite --mode dev",
  "dev:test": "vite --mode test",
  "build:test": "tsc -b && vite build --mode test",
  "build:prod": "tsc -b && vite build --mode prod",
  "preview": "vite preview",
}
```

- SPA 的 `VITE_*` 在 build 时烤进产物 → **每环境一份构建产物**(`build:test` / `build:prod`),
  不存在"一份产物多环境"。
- **不引入运行时 `config.json` 注入**:公共配置一律走构建期 `.env.<env>`,按环境分别构建。

## 静态产物

```text
dist/
  index.html
  version.json
  assets/
```

`dist/` 是 Vite 直接生成的完整静态产物，不做二次封装。`.env.*`、源码、测试、部署脚本和
开发依赖不进入 `dist/`。
