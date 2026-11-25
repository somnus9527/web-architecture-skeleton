# 前端骨架规范一致性审计（2026-11-25）

- 范围：`test/web-architecture-skeleton`（当前规范单源仓库，`main`）
- 方法：通读 `rules/**`、三个 skeleton、`tools/**`、`skills/**`、`manifests/**`、仓库说明与 CI；用只读脚本检查物化文档链接；在临时副本中运行真实初始化器复现初始化结果；`verify-gates` 三个变体实跑为 24/24、24/24、26/26。
- 结论：**规则单源 + 物化的骨架成立，但「公共层 / 变体层」边界没有守住**，同时 2026-11-24 之后骨架的演进（`api-client.ts`、公开区 locale route、RN 测试栈、`run-*-with-env` 脚本）没有回写规则。当前规范里有一批「照做会失败」和「同一文档两套事实」的问题。

## 量化口径

| 项                      | 当前值                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| 规则源                  | 54 份（shared 7、frontend 17、spa 8、ssr 22）+ RN 30 份 + RN 模板 19 份 |
| 物化产物                | spa 26、ssr 39、rn 50                                                   |
| 物化文档死链            | 18 处（SPA 8、SSR 10、RN 0）                                            |
| 规则中 `APIClient` 提及 | 8 份文档、30 处；实际实现为 `api-client.ts` 的 `apiRequest`             |
| RN 规则点名的架构测试   | 17 个文件；实际存在 1 个                                                |
| 初始化冒烟覆盖          | 3 个变体、仅 `bff-only`；不检查链接，`next-backend` 无用例              |

---

## P1：照规范执行会失败或做错

### P1-01 公共 `project-naming` 按 SSR 写死，物化进 SPA 后一套文档两套身份

- 证据：`rules/shared/project-naming.md:23-31` 的占位表是 `SSR Application Skeleton`、`ssr-app`、`ssr_app`、`ssr-app-api`、`next-backend`；同文件 `:45-51` 的清单要求确认 `backend-mode`、PM2、BFF 前缀，并同步 `.agents/ssr-project.md`、grep `ssr-app|SSR Application Skeleton`。
- 物化后：`skeletons/spa/docs/rules/shared/project-naming.md` 原样保留这些内容，文末才追加 `spa-app` 占位说明（`rules/spa/project-naming-variant.md:55`）。
- 影响：SPA 初始化者按上半部分替换会得到 SSR 身份；按清单核对 PM2/BFF/`ssr-project.md` 必然卡住；文末又告知占位值是 `spa-app*`，同一文档自相矛盾。
- 修法：公共正文只保留 `<project-id>`、后端关系与通用派生规则；占位值表、PM2、cookie、BFF、`ssr-project.md`、grep 命令全部下沉到 `rules/ssr/project-naming-variant.md`，SPA 侧只保留自己的占位表。

### P1-02 `next-backend` 是幽灵模式：仍可选，但规则、代码、文档支撑已删除

- 证据：`skills/initialize-ssr-project/scripts/initialize-ssr-project.mjs:85-86` 仍接受 `next-backend`，`:482` 还告诉用户启用 `next-backend/**` 规则；`skeletons/ssr/README.md:11,31,35` 宣传该模式；`rules/ssr/ssr-security-baseline.md:22` 等 6 处链接 `../next-backend/*.md`；`docs/migration.md:16` 明确「两者均不再分发」。
- 代码侧：`skeletons/ssr/src/` 没有 `server/`，README 目录表却列出 `src/server/`（`skeletons/ssr/README.md:95`）；`tools/check-init-smoke.mjs` 的 SSR 用例只跑 `bff-only`，禁用模式对 `next-backend` 产物永远不生效。
- 影响：选择该模式的项目会得到一份指向不存在规则目录的规范、空的后端实现目录，且完全没有门禁覆盖。
- 修法：二选一——删除 `next-backend` 参数与全部宣传/步骤，或恢复 `rules/next-backend/**` 与 `src/server` 最小骨架；同时给冒烟补 `next-backend` 用例。

### P1-03 物化产物有 18 处死链，且断的正是必读入口

- SPA（8 处）：`docs/rules/frontend/environments-and-build.md:5,39` 指向 `./ssr-runtime-config.md`；`frontend-security.md:5` 指向 `./ssr-security-baseline.md`、`./ssr-bff-boundaries.md`；`delivery-verification.md:5,22` 指向 `../backend/README.md`、`./ssr-ui-runtime.md`；`docs/rules/shared/module-documentation.md:50,110` 指向 `../backend/*`。
- SSR（10 处）：6 处 `../next-backend/*`（`ssr-bff-boundaries.md:11`、`ssr-cache-and-performance.md:4-5`、`ssr-frontend-architecture.md:57`、`ssr-observability-and-logging.md:7`、`ssr-security-baseline.md:22`、`ssr-verification.md:14`）；`docs/deployment/online-release.md:4` 的 `../rules/next-backend/pm2-deployment.md`；`delivery-verification.md:5` 与 `module-documentation.md` 的 `../backend/*`。
- 影响：`environments-and-build`、`frontend-security`、`delivery-verification` 都是「必读」，读者被指向 404；`check-init-smoke` 只查字符串 `docs/rules/next-backend`，查不到相对路径写法。
- 修法：公共正文不得链接变体专属/已下线文档，改为条件表述（「SSR 见 …，仅 SSR 变体分发」）；`../backend/*` 改成「配套后端仓库的 `AGENTS.md` / `docs/rules/backend/`」这种不带相对链接的指引；把链接解析加入 `check-init-smoke` 或单独脚本。

### P1-04 变体补段的脚本矩阵与真实 `package.json` 冲突

- SPA：`rules/spa/environments-and-build-variant.md:7-12` 写 `vite --mode` + `tsc -b && vite build`，实际 `skeletons/spa/package.json:26-27` 走 `run-vite-with-env.mjs`；`skeletons/spa/src/test/architecture/deployment.test.ts:14` 强制要求含 `run-vite-with-env.mjs`。
- SSR：`rules/ssr/environments-and-build-variant.md:6-16` 写 `node --env-file=.env.<env> next ...`，实际 `skeletons/ssr/package.json:9-18` 走 `run-next-with-env.mjs`，后者负责生成/校验 `NEXT_DEPLOYMENT_ID`。
- 影响：照抄脚本会绕过 release ID 生成与 `deploymentId` 接线；SPA 直接白屏或架构测试失败，SSR 生产构建可能直接 throw。
- 修法：删除规则里的完整脚本块，只保留「每环境必须经 `run-*-with-env` 加载」的原则；脚本矩阵以 `package.json` 为准，必要时由脚本生成文档片段。

### P1-05 SPA 初始化漏改 CI 与三个 env 模板，派生项目仍带 `/spa-app/` 和 base path `/`

- 证据：`skills/initialize-spa-project/scripts/initialize-spa-project.mjs:10-21` 的 `RUNTIME_IDENTITY_FILES` 只含 `.env.example`、`.env.mock`；`:218-219` 只对这两个文件替换 base path。
- 实测（临时副本跑真实初始化，`--no-backend audit-check`）：`.github/workflows/check.yml:64-65` 仍是 `VITE_APP_TITLE=SPA Application`、`VITE_APP_BASE_PATH=/spa-app/`；`.env.prod.example:2-3`、`.env.dev.example`、`.env.test.example` 仍是旧标题与 `VITE_APP_BASE_PATH=/`。
- 影响：`pnpm env:init prod` 生成的 `.env.prod` base path 是 `/`，与 Nginx location `/<project-id>/` 不一致，产物 404；CI 仍按 `/spa-app/` 构建，门禁全绿但产物不可用。
- 修法：把 `.github/workflows/*.yml`、`.env.{dev,test,prod}.example` 纳入替换清单；补一条初始化后断言（CI/env 模板中不得残留 `spa-app` 或 `VITE_APP_BASE_PATH=/`）。

### P1-06 SSR 生产环境模板把安全开关关掉，且 `env:init prod` 会原样复制

- 证据：`skeletons/ssr/.env.prod.example:11-15` 为 `SESSION_COOKIE_SECURE=false`、`CSRF_ENABLED=false`、`NEXT_PUBLIC_APP_ENV=mock`；`rules/frontend/frontend-security.md:34` 要求生产 CSRF 必须开且有真实校验。
- 复制链路：`skeletons/ssr/scripts/init-local-env.mjs` 是纯 `copyFileSync`，生成的 `.env.prod` 即上述值。
- 影响：按模板部署得到非 Secure 会话 cookie + 生产关闭 CSRF + 前端误判为 mock；安全红线在交付物里直接失效。
- 修法：prod 模板改为 `SESSION_COOKIE_SECURE=true`、`CSRF_ENABLED=true`、`NEXT_PUBLIC_APP_ENV=prod`；`server-config` 对 `APP_ENV=prod` 强制校验这两个开关，模板错误时启动失败。

### P1-07 会话凭证存储：安全红线与 store 规则互斥，SPA 实现站在被禁一侧

- 证据：`rules/frontend/frontend-security.md:26` 要求会话凭证必须放 HttpOnly cookie，**禁止** `localStorage` / `sessionStorage`；`rules/frontend/store.md:50-54` 却说「`localStorage` is the default carrier」；`skeletons/spa/src/shared/store/session-store.ts:74` 用 `createJSONStorage(() => localStorage)` 持久化 token。
- 影响：两份核心规则对同一件事给出相反要求；按 security 改会推翻现有 store 与 Bearer 方案，按 store 改则红线条目作废。派生项目无法判断哪条优先。
- 修法：写死一种默认（Web 端建议 HttpOnly cookie），把 Bearer 作为需 ADR 记录的例外；`store.md` 不再给 `localStorage` 默认背书，并让 `session-store` 与结论一致。

### P1-08 `APIClient` 存在三套名字，模板复制即断

- 证据：`rules/frontend/frontend-architecture.md:63` 要求 `src/shared/tools/APIClient`；实际 `skeletons/spa/src/shared/tools/api-client.ts:130` 导出的是 `apiRequest`（不存在 `apiClient` 对象）；`templates/frontend/feature-service.md:6,17` 却 `import { apiClient }` 并调用 `.get()`。
- 影响：按模板写 service 直接 import 失败；按规则新建 `APIClient.ts` 会与现有 client 重复（Linux/CI 区分大小写）；SSR 规则 `rules/ssr/api-contracts-variant.md:4` 也要求 SPA 专属路径，而 SSR 的 `src/shared/` 没有 `tools/`。
- 修法：统一为 `api-client.ts` + `apiRequest`（或恢复 `apiClient` 对象并同步骨架）；规则、模板、AGENTS 一次改齐；SSR 单独指向 `src/bff/shared/http-client.ts`。

### P1-09 单文件行数硬限两套：规则 1500/2000，门禁 800/400/300/200

- 证据：`rules/frontend/frontend-react.md:21` 写「1500 行拆分，硬限 2000」；`rules/frontend/frontend-architecture.md:95` 又说「above 500 行拆分」；`skeletons/spa/src/test/architecture/file-split-boundary.test.ts:11-20` 实际 page 400 / hook 200 / service 200 / component 300 / 硬限 800。
- 影响：写到 1200 行按规则合规，但 `quality:check` 必红；反向按 800 行事又与规则冲突，且规则完全没提分类阈值。
- 修法：把真实的分类阈值写进 `frontend-react.md`（或规则直接引用门禁常量），删除 1500/2000 与「500 行」的第三套说法。

### P1-10 SSR 文档否认 locale route，但公开页骨架就是 `[locale]`

- 证据：`skeletons/ssr/README.md:13`「cookie 模式 i18n，不使用 locale route」；`skeletons/ssr/docs/initialization/ssr-app-initialization.md:31`「默认不使用 locale route」；`rules/ssr/ssr-frontend-architecture.md:35` 与 `rules/ssr/ssr-delivery-workflow.md:26` 同口径。
- 反证：`skeletons/ssr/src/app/[locale]/` 真实存在；`skeletons/ssr/docs/decisions/adr-000-ssr-project-baseline.md:15` 明确公开页 `/zh-CN` `/en-US`；`rules/ssr/ssr-i18n.md:7-10` 也写「公开内容区使用 locale route，非公开区不用」。
- 影响：初始化清单会让新项目删掉公开区 locale 路由，与 SEO 基线、ADR-000 和代码直接冲突。
- 修法：四处统一为「公开区 locale route + 非公开区 cookie」；`ssr-project-baseline` 保留「默认不由脚手架启用、ADR 批准」的措辞即可。

### P1-11 RN 规则与 RN 骨架是两套事实，开工即失败

- **alias**：`rules/rn/typescript.md:105-110,136` 要求 `@api/*`、`@components/*` 等无斜杠 alias，并禁止 `@/api/client`；`skeletons/rn/tsconfig.json:6` 只有 `@/*`，现有源码（`src/components/home/home-screen.tsx:4`）全部用 `@/`。按规则写新代码无法解析。
- **Paper 边界**：`rules/rn/ui-components.md:45` 禁止业务代码直接 import Paper，`:54-56` 只允许 `paper-controls.tsx`、`paper-theme-provider.tsx`；实际 `skeletons/rn/src/components/home/home-screen.tsx:1` 直接 import Paper，`src/components/ui/` 只有 `screen.tsx`，两个允许文件都不存在。
- **API 契约**：`rules/rn/api.md:27-33` 要求 `config.ts / errors.ts / logger.ts`，`:60-64` 的 `ApiError` 带 `status`；实际 `skeletons/rn/src/api/client.ts:22-36` 只有 `code`，且 `client.ts:48` 直接读 `process.env`。依赖 `error.status` 的重试规则无法实现。
- **env:init 不可用**：`skeletons/rn/scripts/init-local-env.mjs:12-21` 找 `.env.{dev,test,prod}.example`，仓内只有 `.env.example`；README:32 又让人 `cp .env.example .env.local`。三条路径互不一致。
- **测试与门禁**：规则点名 17 个 `src/test/architecture/*.test.ts`，实际只有 `layering.test.ts`；`manifests/rn.json:11-16` 干脆把共享架构测试设为 `false`，`gates` 只写 `hygiene`。
- 影响：RN 派生项目按规则无法通过 typecheck，Paper/日志/图片/长列表等 wrapper 全部缺件；规则宣称的 17 个守护测试只有 1 个真实存在。
- 修法：先选定「以骨架为准」还是「以规则为准」；若以规则为准，补 7 个 alias、Paper/logger/image/flat-list wrapper、`config/errors/logger` 与缺失依赖；若以骨架为准，则反向修订规则并删掉不存在的测试与模块承诺。

---

## P2：事实性偏差与维护风险

| ID    | 问题                                                                                                                  | 证据                                                                                                                                                                         | 影响 / 修法                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P2-01 | 规则要求 mock 契约拆分，骨架只有单体 `openapi.yaml`                                                                   | `skeletons/spa/docs/rules/frontend/mock-and-integration.md:9`；`mocks/` 仅 `openapi.yaml`                                                                                    | 新项目照规则拆 `mocks/components                                                           | examples`，骨架自身不合规；补拆分或降级为可选 |
| P2-02 | 规则反复要求 `src/types/dto/`，两个 skeleton 都没有该目录，模板却从该路径 import                                      | `rules/frontend/frontend-architecture.md:85`；`templates/frontend/feature-service.md:8`                                                                                      | 模板复制即断；补骨架示例目录，或把 DTO 落点改成 feature types                              |
| P2-03 | `VITE_API_MODE` 没有读取方，两份规则却说它负责切换环境                                                                | `skeletons/spa/docs/rules/frontend/delivery-verification.md:56`；`src/vite-env.d.ts:5` 仅类型声明                                                                            | 改它不会改变请求；删除或真正用于选 base URL                                                |
| P2-04 | SPA Nginx static root 两种写法                                                                                        | `docs/deployment/nginx-handoff.md:8` 写 `/var/www/<project-id>`；`nginx.example.conf:6` 是 `root /var/www`                                                                   | 按 handoff 设置会把 URI 拼成 `/var/www/<id>/<id>/assets/...`；统一为一种布局               |
| P2-05 | SSR Nginx 示例端口与骨架默认端口不一致                                                                                | `skeletons/ssr/docs/deployment/nginx.example.conf:8` 是 `3000`；`.env.example:6` 与 `ecosystem.config.cjs` 默认 `3001`                                                       | 照示例部署指向空进程；改为 3001 或注明跟随 `PORT`                                          |
| P2-06 | SSR README 指向不存在的锚点                                                                                           | `skeletons/ssr/README.md:35` 的 `./docs/rules/README.md#backend-mode-scope`；生成的 README 只有「必读 / 其余规则」                                                           | 补「后端模式适用范围」小节，或删锚点                                                       |
| P2-07 | MUI provider 示例的目录与版本路径与骨架不符                                                                           | `rules/ssr/next-app-router-mui-provider.md:16,21` 用 `src/shared/ui/theme.ts`、`v15-appRouter`；实际 `src/shared/theme/theme.ts`、`v16-appRouter`                            | 照示例新建会引入不存在目录；同步实际路径并注明按 Next 主版本调整                           |
| P2-08 | SSR i18n 规则残留 monorepo 路径                                                                                       | `rules/ssr/ssr-i18n.md:139` 写 `apps/<app>/src/locale/<lang>.json`；实际 `src/locale/*.json`                                                                                 | 单 app 项目无法照做；改为 `src/locale`                                                     |
| P2-09 | 规则禁止散读 `process.env`，`proxy.ts` 直接读 `process.env.APP_ORIGIN`                                                | `rules/ssr/ssr-runtime-config.md:29`；`skeletons/ssr/src/proxy.ts:231`                                                                                                       | 绕过 zod 校验与 prod/localhost 约束；抽 edge 侧 config accessor                            |
| P2-10 | 规则要求 `unauthorized.tsx` / `forbidden.tsx`，骨架没有                                                               | `rules/ssr/ssr-verification.md:23`；`src/app` 只有 `error/global-error/not-found`                                                                                            | 交付自检必不过；补页面或把条件降级为「采用 `forbidden()` 的项目才要求」                    |
| P2-11 | RN README/AGENTS 过期或与物化机制不符                                                                                 | `README.md:8,10,11`（theme 在 `src/domain`、`src/storage` 不存在、测试「尚未引入」但同一文件已列 Jest 门禁）；`AGENTS.md:3` 声称由 `rules/rn/` 物化，但 `rules/rn` 无 AGENTS | 新成员找不到目录；改为实际布局，并修正物化说明                                             |
| P2-12 | 仓库 README 的「迁移状态」整表过期，工具/技能列表含不存在项                                                           | `README.md:41-50` 仍写 rules 抽取未开始、RN 待建、templates 未开始；`:21-22` 列 `audit`、`audit-derived-repo`                                                                | 维护者按 README 判断仓库状态；改为当前状态并链接 `docs/migration.md`                       |
| P2-13 | `rules/README.md` 仍写 RN 物化目标待定                                                                                | `rules/README.md:11`「待定：`skeletons/rn` 尚未建立」                                                                                                                        | 与事实相反；改为 `skeletons/rn/docs/rules/rn/`                                             |
| P2-14 | `docs/migration.md` 的「已知遗留」1–4 已过期                                                                          | `docs/migration.md:42-53`（规则未抽取、技能未上提、RN 不存在、断链文件清单）                                                                                                 | 真正的剩余项被埋没；移到「已完成」，重列当前剩余项                                         |
| P2-15 | README 声称冒烟「两个变体…无死链」，实际三变体且不查链接；CI 也不跑骨架代码门禁                                       | `README.md:60`；`tools/check-init-smoke.mjs:33-40` 仅查禁用字符串 + `verify-gates`；`.github/workflows/skeleton.yml` 仅三步纯 Node                                           | 18 处死链和骨架代码回归都能过 CI；补链接检查与至少 typecheck/test 矩阵                     |
| P2-16 | 共用规则写死 SPA 脚手架脚本，且脚本不存在                                                                             | `rules/frontend/frontend-react.md:16` 的 `python3 scripts/create_react_app.py`；全仓无此文件，唯一入口是 `skills/initialize-*-project`                                       | 该段物化进 SSR 后成为错指令；整段移入 SPA 补段或删除                                       |
| P2-17 | mock 规则自称仅适用于 Vite SPA，却分发给 SSR                                                                          | `rules/frontend/mock-and-integration.md:3`；SSR 实际用 `run-next-with-env.mjs`                                                                                               | SSR 读者照抄 SPA 切换路径；Scope 改为共用 + 变体补段                                       |
| P2-18 | 原语 hook 名字在同一套规则里不一致                                                                                    | `rules/frontend/frontend-react.md:66` 的 `useHttp` / `useDebounce`；真实资产是 `useRequest` / `useDebouncedValue`（`shared-capabilities.md:19`）                             | 派生项目会造重名 hook；改为真实名字                                                        |
| P2-19 | 断点「单一来源」指向不存在的 `packages/ui`，且 `wide` 有两个值                                                        | `rules/frontend/responsive-and-breakpoints.md:3`、`:16`（≥120rem）、`:29`（90rem）                                                                                           | 单 app 项目无落点，宽屏阈值前后不一致；改为 `src/shared/theme/design-tokens.ts` 并统一数值 |
| P2-20 | manifest 的 `gates` 字段没有消费方；RN `sharedAssets:false` 却仍收到「共享资产强制内置」ADR                           | `manifests/rn.json:11-28`；`skeletons/rn/docs/decisions/adr-001-shared-assets-and-gates.md`                                                                                  | 元数据误导；删除死字段或接入校验，ADR 按变体条件生成                                       |
| P2-21 | 三个 skeleton 的 `architecture-rules-lock.json` 的 `files` 都是 `{}`，`sourceCommit`/`syncedAt` 却像已同步且落后 HEAD | `skeletons/spa/.agents/architecture-rules-lock.json` 等                                                                                                                      | 首次同步会把全部文件当作「采用」，审计追踪失真；明确首次同步语义或写入真实基线             |
| P2-22 | 卫生白名单跨端共用，SPA 放行 SSR/RN 变量                                                                              | `skeletons/spa/.repo-hygiene.json:8,21`（`VITE_`、`NEXT_*`、`SESSION_COOKIE_*`、`EXPO_PUBLIC_*`）                                                                            | 已知取舍，但文档未标注；收紧需 materialize 支持 base + overlay                             |

---

## P3：低风险但应一并清理

- 根 README 说「两条检查」，CI 实际三步（materialize、init smoke、monorepo 边界）；`README.md:59-60`。
- `rules/shared/project-rule-capture.md:22` 仍写 `shared/**`、`frontend/**`、`backend/**` 由本模板维护，与「Java 后端规则不随前端骨架分发」冲突。
- `rules/rn/README.md` 的 `startup.md` 主题写成「启动 Discipline 规则」，中英混排（非事实错误）。
- `docs/rules-triage.md:83,119` 的遗留项仍说「索引必读分组丢失」，但 `materialize` 已实现 `mustRead` 分组；真正未做的 `--backend-root` 清理仍挂着。

---

## 为什么现有门禁没拦住

1. `verify-gates` 只检查脚本/配置文件**存在**，不检查内容与规则是否一致（三个变体全绿）。
2. `check-init-smoke` 只做两件事：初始化脚本能跑完、产物不含三条禁用字符串；不解析链接，也不跑 `next-backend` 分支。
3. `materialize` 只保证「产物 = 源」，源本身自相矛盾时会把矛盾原样放大到三个变体。
4. 仓库 CI 不安装依赖、不跑 skeleton 的 typecheck/lint/test，因此骨架代码与规则的漂移无人发现。

## 建议修复顺序（按载体）

**规则（先定事实源）**

1. 拆分 `project-naming`：SSR 专属内容下沉，公共正文只留通用项。
2. `next-backend` 做决策并一次改齐 skill/README/AGENTS/初始化清单/部署文档。
3. 公共层去掉变体专属链接与 SPA-only 指令；断链清零。
4. 脚本矩阵改为引用 `package.json`，删除手抄块；行数阈值、APIClient 命名、locale 表述、凭证存储口径统一。

**骨架**

5. SPA：`.env.*.example` 与 CI 的 base path/title 纳入初始化；`src/types/dto` 与模板对齐。
6. SSR：prod env 安全开关、Nginx 端口、MUI 示例、`unauthorized/forbidden`、`src/server` 与 next-backend 决策保持一致。
7. RN：先定「规则 or 骨架」为准，再补 alias/wrapper/依赖/测试，或反向删规则承诺。

**脚本**

8. 初始化器增加「残留占位值」断言（CI/env 模板/文档），并把 `next-backend` 纳入冒烟。
9. `check-init-smoke` 增加 Markdown 链接解析；CI 增加 skeleton 的 typecheck/test 矩阵。

**技能**

10. `initialize-ssr-project` 的模式选项与 `sync-architecture-rules` 的索引锚点随规则同步；`docs/rules/README.md` 补 backend-mode 小节或删除引用。

## 验收建议

```bash
# 物化一致
node tools/materialize.mjs && git diff --exit-code

# 死链为零（需新增脚本或内联检查）
node tools/check-doc-links.mjs

# 三变体初始化
node tools/check-init-smoke.mjs

# 变体门禁（在临时副本中）
(cd skeletons/spa && pnpm quality:check)
(cd skeletons/ssr && pnpm quality:check)
(cd skeletons/rn && pnpm quality:check)
```

## 修复状态（2026-11-25 追记）

- 已处理：P1-01（project-naming 拆分）、P1-02（删除 next-backend）、P1-03（文档链接清零）、
  P1-04（脚本矩阵）、P1-05（SPA 初始化覆盖 CI/env 模板）、P1-06（SSR prod 安全默认）、
  P1-07（凭证存储口径）、P1-08（API client 命名）、P1-09（行数阈值）、P1-10（SSR locale 表述）。
- 已处理：P1-11（RN 规则/骨架对齐：alias、Paper 边界、API 层、env 初始化、Provider/测试栈）。
- P2 中的文档状态、断链、Nginx、MUI、i18n 路径、DTO/断点、模板/API 命名等已顺带修正；
  RN 仍保留 `expo-image`/`netinfo` wrapper、EAS 发布脚本与部分架构测试为待办（见 RN README）。
- 仍保留：P2-15 的 CI 覆盖范围（CI 仍以纯 Node 检查为主，skeleton 的 `quality:check` 由本地/项目 CI 执行）、
  P2-22 的跨端卫生白名单取舍。

> 本文是 2026-11-25 的审计快照；行号对应审计时的 `main`（`e2b4ef2`）。
