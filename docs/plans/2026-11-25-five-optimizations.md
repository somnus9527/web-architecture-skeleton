# 前端架构规范五项优化方案

- 日期：2026-11-25
- 范围：`test/web-architecture-skeleton`（规则单源、`skeletons/{spa,ssr,rn,monorepo}`、`shared-assets/`、`tools/`、`skills/`）
- 结论：基础门禁已经成立，但**「可执行」只覆盖了 env、大文件、文件行数和少量目录边界**。本次五项里，凭证存储、XSS sink、UI 边界、通用能力复用都仍是「规则写了、代码没守、门禁没查」；commit 阶段则只跑了 lint 与卫生检查。下面按「规则 / 骨架 / 脚本 / 技能」四类载体给出可落地方案，不改变现有「规则单源 + 物化」的总体架构。

## 0. 先给结论

| 问题                   | 现状判断                                                                    | 建议优先级 | 核心手段                                                                    |
| ---------------------- | --------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| 1. commit 阶段稳定拦截 | 只拦 env/大文件/格式，架构与安全约束要等 CI                                 | P0         | `pre-commit` 分片扫描 + `commit-msg` 证据 trailer + `pre-push` 增量影响测试 |
| 2. 安全规范缺漏        | 规则覆盖较全，但 SPA 代码仍把 token 放 localStorage，且无一执行检查         | P0         | 改 HttpOnly cookie + 安全 sink 扫描 + ESLint 安全规则 + CSP/CSRF 硬校验     |
| 3. 通用能力复用        | 有 4 个共享 hook，但「发现重复」只靠一条窄正则，AI 没有查询入口             | 暂缓       | 本轮不动；后续再定能力注册表与检测方式                                      |
| 4. 通用 UI             | 有 7 个原语，但无统一出口、无 Input/Select/Dialog/Table，业务直接用原生标签 | P1         | MUI 薄封装 + `index.ts` 单一出口 + 原生标签/直引 MUI 的 ESLint 边界         |
| 5. 其他缺失            | 可访问性、API 契约漂移、i18n 硬编码、依赖审计、错误码/日志脱敏、覆盖率等    | P2         | 先补「能失败」的检查，再补资产；不要一次铺开                                |

一句话：**不要继续往规则文档里加句子，要给每条红线配一个会失败的检查；不能失败的规则等同于注释。**

## 1. 现状基线（避免重复造）

已经成立、本次不应推翻的部分：

- `rules/**` 单源 + `tools/materialize.mjs` 物化 + CI 校验产物一致。
- `check-repo-hygiene.mjs` 覆盖 env 文件、变量白名单、私钥、二进制、体积、包管理器、疑似密钥，pre-commit 用 `--staged`，CI 用 `--tracked`。
- 架构测试已覆盖 feature 隔离、shared 反向依赖、文件行数、请求三态、shared UI 无业务依赖、目录清单存在性。
- SPA 已有 `useRequest` / `useAsyncAction` / `useDebouncedValue` / `useDisclosure`，工作台已经按组合方式使用，不是反例。
- SSR 已有 HttpOnly cookie、Origin/CSRF 校验、CSP、HSTS、BFF cookie→Authorization 转换。
- 三个变体都有 `quality:check`，仓库 CI 有质量矩阵。

但这些检查的共同盲区是：**只验证「文件存在 / 文本命中窄模式」，不验证「业务代码是否走了共享资产」**。所以派生项目仍会各自长出一套。

## 2. 问题一：commit 阶段稳定拦截

### 2.1 事实

SPA 的提交钩子只有两步：

- `.husky/pre-commit`：`lint-staged` + `check-repo-hygiene.mjs --staged`（`skeletons/spa/.husky/pre-commit:2-3`）。
- `.husky/commit-msg`：只跑 `commitlint --edit`（`skeletons/spa/.husky/commit-msg:2`）。

`commitlint.config.cjs` 只校验 type 前缀，其余规则全部关闭。也就是说：

- 提交一个 `dangerouslySetInnerHTML`、把 `userInfo`（内含 `token`）整体 `persist` 到 localStorage、业务页原生 `<button>`、或 feature 内重复 hook，**pre-commit 完全不会失败**；
- `commitlint` 只读 commit message，**读不到 staged 文件**，把文件级约束硬塞进 commitlint 规则是不稳定的。

### 2.2 设计：commit-msg 是「commitlint + 证据脚本」，不是「commitlint 包办一切」

保留 commitlint 做它该做的事：type、scope、trailer 格式。新增一个同属 `commit-msg` 阶段的证据脚本，读 staged 文件与 message，要求风险改动带对应 trailer：

| 改动类型                                                                    | 必须出现的 trailer                                  | 目的             |
| --------------------------------------------------------------------------- | --------------------------------------------------- | ---------------- |
| 新增 `src/features/**/hooks/use-*.ts`                                       | `Reuse-Check: <capability-id>` 或 `none (<reason>)` | 强制先查共享能力 |
| 新增/修改 `src/shared/components/ui/*.tsx`                                  | `UI-Catalog: <Component>`                           | 强制同步 UI 清单 |
| 修改 `api-client` / `session-store` / `cookie` / `route-security` / `proxy` | `Security-Review: <一句话>`                         | 安全敏感改动留痕 |
| 修改 `.agents/*-exceptions.json`                                            | `Exception: <id>`                                   | 例外可追溯       |
| 新增依赖                                                                    | `Dependency: <name> <reason>`                       | 供应链变更留痕   |

示例：

```text
feat(auth): switch SPA session to httpOnly cookie

Reuse-Check: use-request
Security-Review: login response no longer returns token; cookie is set by BFF
```

`commitlint` 侧新增一个本地 plugin（`commitlint-plugin-skeleton.cjs`），只校验这些 trailer 的**格式**（键存在时值不能为空、多行不能截断）；**是否必须出现**由证据脚本按 staged 文件判断。两者一起挂在 `.husky/commit-msg`，缺一即失败。

### 2.3 `pre-commit` 分片扫描

新增 `scripts/check-staged.mjs`，按 staged 文件分流，控制在 2 秒级：

```text
check-staged.mjs --staged
  ├─ check-repo-hygiene.mjs --staged        （已有，env/大文件/密钥）
  ├─ check-security.mjs --staged            （新增，sink/凭证/URL/消息）
  └─ check-ui.mjs --staged                  （新增，原生标签/直引 MUI/第二套 UI 根；Phase 3 接入）
```

`pre-push` 不做全量架构测试，改跑**增量影响测试**：

```text
check-changed.mjs --base @{push}
  ├─ 只改 docs/rules        → check-doc-links + materialize diff
  ├─ 只改样式/静态资源      → 相关 lint/format + build（可选）
  ├─ 改 src/features/**     → 该目录相关 eslint + 受影响架构测试（feature-isolation / hook-duplication / file-split-boundary）
  ├─ 改 src/shared/**       → shared-independence / shared-ui-contract / shared-capabilities / file-split-boundary
  ├─ 改 router/app/**       → layer-boundary / file-split-boundary
  ├─ 改 scripts/husky/CI    → verify-gates + 脚本负向 fixture
  └─ 改依赖/lockfile        → pnpm audit --audit-level=high + typecheck
```

实现要点：

- `git diff --name-only --diff-filter=ACMR @{push}...HEAD` 取本次推送的变更；没有 upstream 时回退 `origin/main...HEAD`，再回退 `HEAD~1`。
- 架构测试按「变更路径 → 测试文件」映射挑选，不跑全量；只有 CI 或手动 `pnpm check:architecture:full` 跑全量。
- `check-security.mjs` 与 `check-ui.mjs` 在 pre-push 只扫变更文件；全量扫描仍由 CI `--tracked` 负责。
- 增量结果只代表「本次改动没踩已知约束」，不能替代 CI 全量结论；这一点写进 pre-push 输出。

CI 对这些脚本统一用 `--tracked`，保证「本地能过、CI 才炸」的缝隙被补上。

### 2.4 `verify-gates` 从「存在」升级为「内容」

当前 `tools/project/scripts/verify-gates.mjs` 只检查脚本/配置/CI/husky 是否存在，husky 里写不写检查都能过。至少增加：

- `pre-commit` 必须包含 `check-staged` 或四个分片脚本；
- `commit-msg` 必须包含 `commitlint` 与 `check-commit-evidence`；
- `package.json` 必须包含 `check:security`、`check:ui`、`check:architecture`、`check:changed`；
- `quality:check` 必须串联上述检查；
- 每个检查脚本必须自带一个「负向 fixture」测试，证明它真的会失败。

### 2.5 验收

- 故意 stage `.env.prod` → pre-commit 失败（已有）。
- 故意 stage 3 MB 二进制 → 失败（已有）。
- 故意 stage `localStorage.setItem('session', JSON.stringify({ userInfo }))` → `SEC-001` 失败（含 `userInfo.token` 深层字段）。
- 故意 stage `persist(..., { pick: ['userInfo'] })`，且 `IUserInfo` 含 `token` → `SEC-001` 失败。
- 故意 stage `dangerouslySetInnerHTML` → `SEC-002` 失败。
- 故意 stage 业务页 `<button>` → `UI-001` 失败。
- 正常改动 → 全部通过，且耗时不超过约定阈值；pre-push 只跑本次变更相关检查。

## 3. 问题二：安全规范缺漏与执行

### 3.1 最严重的事实：规则禁止，骨架自己违反

`rules/frontend/frontend-security.md:26` 写得很清楚：

> 会话凭证必须放 `HttpOnly` + `Secure` + `SameSite` Cookie，禁止放 `localStorage` / `sessionStorage` / 非 HttpOnly cookie / JS 可读的全局变量。

但 SPA 的实现是反的：

- `skeletons/spa/src/shared/store/session-store.ts:74` 使用 `createJSONStorage(() => localStorage)` 持久化 `token`；
- `skeletons/spa/src/shared/tools/api-client.ts:139-140` 从 store 取 token 并注入 `Authorization: Bearer`；
- `skeletons/spa/src/features/auth/types/auth.types.ts` 的 `ILoginResult` 直接返回 `token`；
- `skeletons/spa/docs/decisions/adr-000-spa-project-baseline.md:33-35` 把它登记成 Bearer 例外。

这不是「派生项目走偏」，是**骨架把例外当默认**。按本次要求，SPA 与 SSR 统一只走 HttpOnly cookie，**不再保留 Bearer 例外**；网关与页面不同域时，由 Nginx 同源反向代理 `/api/` 收口，不能把跨域 Bearer 当替代方案。

### 3.2 安全缺漏清单（按攻击面）

| 编号   | 缺漏                                                                       | 现状证据                                                                        | 建议                                                                                           |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SEC-1  | 凭证进 Web Storage                                                         | `session-store.ts:74`、ADR-000:33-35                                            | SPA 改 cookie；store 只保留内存用户摘要；登录响应不再返回 token                                |
| SEC-2  | XSS sink 无门禁                                                            | 规则有（`frontend-security.md:18-22`），ESLint/测试没有                         | 禁用 `dangerouslySetInnerHTML`/`innerHTML`/`eval` 等；只留 `SafeHtml`                          |
| SEC-3  | SPA Nginx 缺 CSP/HSTS/frame-ancestors/Permissions-Policy                   | `skeletons/spa/docs/deployment/nginx.example.conf:44-45` 只有两个头             | 补全；CSP 不允许 `unsafe-inline` 脚本                                                          |
| SEC-4  | SSR CSP 仍允许 `script-src 'unsafe-inline'`                                | `skeletons/ssr/src/proxy.ts:244-246`                                            | nonce 化；移除生产 `unsafe-inline`；保留 `style-src` 说明                                      |
| SEC-5  | 生产配置不强制 CSRF/Secure cookie                                          | `skeletons/ssr/src/bff/shared/server-config.ts:63-64` 只校验 URL 与 key         | `APP_ENV=prod` 时强制 `CSRF_ENABLED=true`、`SESSION_COOKIE_SECURE=true`、`NODE_ENV=production` |
| SEC-6  | 缺 `postMessage`/`target=_blank`/`window.open`/`srcdoc`/`javascript:` 规则 | 规则未提；代码目前少，但派生项目会写                                            | 补规则 + 扫描：消息必须指定 origin；外链必须 `noopener noreferrer`                             |
| SEC-7  | `document.cookie` 可写会话 cookie                                          | `skeletons/ssr/src/shared/utils/cookie.ts:23,62` 暴露 JS 读写                   | 会话 cookie 只能服务端 `Set-Cookie`；JS 工具只用于非敏感偏好                                   |
| SEC-8  | 公开 env 可能带 secret                                                     | `VITE_*`/`NEXT_PUBLIC_*` 无命名/值扫描                                          | 扫描 `SECRET` / `KEY` / `TOKEN` / `PASSWORD` / `PRIVATE` 等前缀组合；命中即失败                |
| SEC-9  | 开放重定向只有建议，没有测试                                               | `frontend-security.md:70`；SPA 有 `readRedirectTarget` 但无架构测试             | 统一 `safeRedirect`；拒绝 `//`、`\`、`javascript:`、外域                                       |
| SEC-10 | 供应链只跑 CI，且无 SRI/新依赖审查                                         | `skeletons/spa/.github/workflows/check.yml` 有 audit；本地 `quality:check` 没有 | `check:deps` 进 CI；新依赖要求 trailer；CDN 脚本要求 SRI                                       |
| SEC-11 | SSR 缓存/SSRF/序列化有规则，无测试                                         | `rules/ssr/ssr-security-baseline.md:31,36-40`                                   | 补 BFF 边界测试：cache key、私网地址、`</script>` 转义                                         |
| SEC-12 | RN 规则要求 `src/storage/*`，骨架没有该目录                                | `rules/rn/storage.md`；`skeletons/rn/src` 无 `storage/`                         | RN 单独补 SecureStore wrapper 与测试（本轮可列为 P1 后续）                                     |

### 3.3 SPA 的 cookie 会话契约（唯一方案）

页面与网关不同域时，不让浏览器直连网关，由 Nginx 同源收口：

```text
浏览器 ── https://app.example.com/       ──▶ Nginx ──▶ dist/ 静态文件
浏览器 ── https://app.example.com/api/   ──▶ Nginx ──▶ gateway（内网地址）
浏览器 ──POST /api/auth/login────────────▶ Nginx ──▶ gateway
        ◀─Set-Cookie: __Host-<project>-session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...
        ◀─{ data: { user }, code: "200" }        # 响应体不含 token
浏览器 ──GET /api/auth/session（同源 cookie 自动携带）──▶ gateway
        ◀─{ data: { isAuthenticated, user } }
浏览器 ──业务请求（同源 cookie 自动携带）──▶ gateway
```

落地要点：

1. `apiRequest` 固定 `credentials: 'same-origin'`，不再读/写任何 token，也不再设置 `Authorization`；只保留 `clearSession` 处理 401/403。
2. `session-store` 去掉 `persist`/`localStorage`，只保留内存态 `user`、`status`；刷新后通过 `/api/auth/session` 水合。
3. `ILoginResult` 改为 `{ user }`；`ILogoutResult` 保留 `success`。
4. 路由守卫从「有没有 token」改为「session 状态」：`unknown` 时先水合，`anonymous` 才跳登录。
5. 网关与页面不同域时，必须由 Nginx 把 `/api/` 反代到网关；cookie 保持同源 `SameSite=Lax`，不引入 `SameSite=None`、CORS credentials 或 Bearer 回退。Nginx 必须转发 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto`，并把 `Set-Cookie` 原样透传。
6. 登录成功后由服务端轮换 session id；登出必须服务端失效并下发清 cookie 的 `Set-Cookie`，前端只清内存态。
7. 所有写操作继续要求 Origin/Referer 或 CSRF token 校验；cookie 自动携带意味着 CSRF 不能省。
8. `session-store.test.ts`、`api-client.test.ts`、mock OpenAPI、登录页测试同步改；新增「响应体不含 token」「请求不带 Authorization」「401 清会话」「刷新后水合」测试。

### 3.4 安全扫描规则（可执行）

新增 `check-security.mjs`，规则 ID 与默认动作：

```text
SEC-001  localStorage/sessionStorage/IndexedDB 存 token/session/credential   fail
SEC-002  dangerouslySetInnerHTML / innerHTML / outerHTML / insertAdjacentHTML fail
SEC-003  eval / new Function / setTimeout(string)                            fail
SEC-004  href/src 动态值出现 javascript: / data: / vbscript:                 fail
SEC-005  target="_blank" 缺 rel="noopener noreferrer"                         fail
SEC-006  window.open 未带 noopener；postMessage 目标为 "*"                    fail
SEC-007  document.cookie 写入会话 cookie（非 shared/utils/cookie.ts）          fail
SEC-008  VITE_*/NEXT_PUBLIC_* 名称含 SECRET/KEY/TOKEN/PASSWORD/PRIVATE        fail
SEC-009  SPA Nginx/SSR proxy 缺 CSP/HSTS/frame-ancestors                      fail
SEC-010  生产 CSP 含 script-src 'unsafe-inline' 或 'unsafe-eval'              fail
SEC-011  APP_ENV=prod 但 CSRF/secure cookie 未开                              fail
SEC-012  登录回跳/redirect 未做站内白名单                                      fail
SEC-013  生产 source map 对公网公开                                           fail
SEC-014  SSR 出站 URL 未做协议/host/私网校验（按调用点）                       fail
SEC-015  用户态响应缺 no-store / cache key 缺租户维度                          fail
```

#### 3.4.1 不能只拦字面量：dealkeys 的真实形态

只看 `localStorage.setItem('token', ...)` 会漏掉绝大多数真实写法。dealkeys 下至少存在这些形态：

| 项目 / 文件                                                        | 形态                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `wgcards-admin-parent/stores/publicStore.ts`                       | `pick: ['userInfo']` + `piniaPluginPersistedstate.localStorage()`，`LoginResponse.token`     |
| `wgcards-b2b-web/src/shared/stores/publicStore.ts`                 | `pick: ['language', 'currency', 'userInfo']` + `storage: localStorage`，`IUserInfo.token`    |
| `uupaycard-web/src/shared/services/user-session.ts`                | `localStorage.setItem(KEY, JSON.stringify({ authorityToken, expireAt }))`                    |
| `wgcards-razer-web/src/shared/store/session-store.ts`              | zustand `persist` + `partialize` 返回 `authorityToken`、`expiresAt`                          |
| `wgcards-xbox-web/src/shared/store/auth-store.ts`                  | `sessionStorage` 存 token + “记住我”额外写 `localStorage`                                    |
| `stock-front/src/utils/auth.js`                                    | `Cookies.set(TokenKey, token)`，JS 可读 cookie                                               |
| `wgcards-admin-parent/utils/auth_access_util.js`                   | `lk_token` 由 `Cookies.get` 读取                                                             |
| `uupaycard-web-admin/src/features/auth/protected-area.tsx`（正例） | 服务端会话边界，注释明确「no token or authentication grant is persisted in browser storage」 |

结论：**token 可能藏在对象字段、persist 的 `pick`/`partialize`、自定义 storage wrapper、JSON.stringify 参数、Pinia 持久化插件和 js-cookie 里。** 扫描器必须理解对象图，不能只匹配字面量键名。

#### 3.4.2 深度检测算法

`check-security.mjs` 的 `SEC-001` 按以下顺序工作：

1. **解析**：用项目已有的 `typescript` 依赖解析 `.ts/.tsx/.js/.jsx`；Vue SFC 先抽取 `<script>` 再解析。
2. **类型索引**：建立 `interface/type` → 属性名/类型 的映射；把 `token`、`accessToken`、`refreshToken`、`authorityToken`、`idToken`、`sessionId`、`jwt`、`credential`、`password` 标记为敏感叶子。
3. **变量索引**：记录变量声明、初始值、类型标注、对象字面量；支持 `const next = { authorityToken, expireAt }` 这类间接写法。
4. **sink 识别**：
   - `localStorage.setItem` / `sessionStorage.setItem` / `window.*Storage.setItem`；
   - `createJSONStorage(() => localStorage)`、`storage: localStorage`、`persist(...)`、`piniaPluginPersistedstate.localStorage()`；
   - 自定义 storage wrapper 内部的 `getItem/setItem`；
   - `Cookies.set` / `js-cookie` / `document.cookie =`；
   - `indexedDB` 的 `put/add`（按对象字段判断）。
5. **递归检查**：
   - 对象字面量：检查每个属性名与嵌套值；
   - 标识符：解析其类型与初始值；
   - 属性访问：还原 `userInfo.token`、`state.session.authorityToken` 这类路径；
   - `JSON.stringify(x)`：检查 `x` 而不是字符串字面量；
   - `pick` / `partialize`：把选中的字段路径映射回 state 类型，检查是否到达敏感叶子。
6. **输出证据链**：不只报文件行，还要报路径，例如：
   ```text
   SEC-001 src/shared/stores/public-store.ts:120
     localStorage.setItem <- persist.pick['userInfo'] <- IUserInfo.token
   ```
7. **允许名单**：release id、locale、theme、cookie consent、草稿等非敏感键；敏感键不允许用「值可能是 null」当豁免。
8. **自测**：为 `userInfo.token`、`pick: ['userInfo']`、`partialize`、`JSON.stringify(session)`、`Cookies.set` 各写一个 fixture，证明命中；为 locale/theme/release id 写反例，证明不误报。

允许名单必须少而明确：

- `src/shared/components/security/safe-html.tsx`：唯一允许 `dangerouslySetInnerHTML` 的文件，内部必须 `DOMPurify.sanitize`（或项目批准的等价库）。
- `src/shared/components/security/json-ld.tsx`：结构化数据，服务端常量 + `<` 转义，不允许用户输入。
- `src/shared/runtime/frontend-version-watcher.tsx`：允许 `sessionStorage`，但只存 release id，不存凭证。
- `src/shared/utils/cookie.ts` / `src/bff/**`：允许 `document.cookie`，但会话 cookie 只能服务端设置。

例外统一放 `.agents/security-exceptions.json`，字段 `id/path/rule/reason/owner/expiresAt`，过期自动失败。

### 3.5 规则文本要补的点

`rules/frontend/frontend-security.md` 已有较好的红线，但需要补：

- `postMessage` 必须显式 `targetOrigin`，禁止 `'*'`；接收侧必须校验 `event.origin` 与 `event.source`。
- `target="_blank"` 必须 `rel="noopener noreferrer"`；`window.open` 必须 `noopener`。
- 禁止 `iframe srcdoc`；`sandbox` 不得同时给 `allow-scripts` + `allow-same-origin`。
- `href`/`src` 的协议白名单要写成共享 `safeUrl()`，不要每处手写。
- CSRF 不能只靠 `SameSite`；写操作必须有 Origin/Referer 或双提交 token。
- Cookie 建议 `__Host-` 前缀、`Path=/`、`Secure`、`HttpOnly`、明确 `Max-Age`；登出必须服务端失效 + 客户端清 cookie。
- 登录成功后轮换 session id，防 session fixation。
- 生产 CSP 禁止 `unsafe-inline` 脚本，SSR 用 nonce；`object-src 'none'`、`base-uri 'self'`。
- 安全头补 `Permissions-Policy`、`Cross-Origin-Opener-Policy`、`Cross-Origin-Resource-Policy`。
- 供应链补 `pnpm audit --audit-level=high`、新依赖审查、SRI、lockfile review。
- 日志/错误脱敏补「token、cookie、密码、完整邮箱/手机号、内部路径」。
- SSR 补 cache key 维度、`serialize-javascript`、prototype pollution、SSRF 私网网段。

## 4. 问题三：通用能力复用（本轮暂缓）

> 2026-11-26 决策：复用体系牵涉面较大，本次实施先不动；保留下面的设计作为后续讨论稿，不作为本轮验收项。

### 4.1 事实

当前只有 4 个共享 hook，且检测很窄：

- `hook-duplication.test.ts:16-20` 只扫 `src/features/**/use-*.ts`，只认 `useEffect` + `setLoading|setIsLoading|setLoadState|setError`，且要求「没有 import shared/hooks」。
- 它抓不到：组件内联 hook、`setTimeout` 去抖、分页状态、`matchMedia`、`navigator.clipboard`、service 里自己拼 `fetch`、复制 formatter、复制整个函数体。
- `shared-capabilities.test.ts:24-29` 只验证「文档里列出的 hook 文件存在」，不验证业务代码是否使用。

所以 AI 的理性选择是：**自己写一份最快的能过门的代码**。要改变激励，不是再写一句「请复用」，而是让「自己写」在提交时失败。

### 4.2 能力注册表

新增 `shared-assets/capabilities.json`（物化到各 skeleton 的 `src/shared/capabilities.json` 或 `docs/`）：

```json
[
  {
    "id": "use-request",
    "kind": "hook",
    "export": "useRequest",
    "path": "src/shared/hooks/use-request.ts",
    "purpose": "异步读取的数据 / loading / error / refetch / mutate",
    "replaces": ["手写 loading/error 三态", "per-feature fetch wrapper"],
    "detect": ["setLoading", "setIsLoading", "setLoadState", "setError"],
    "since": "2026-11-24"
  }
]
```

规则：

1. 新共享能力必须先登记 registry，再写文档；`shared-capabilities.md` 的表格由 registry 生成或校验一致。
2. 新 feature hook 必须在 commit message 写 `Reuse-Check: <id>` 或 `none (<reason>)`。
3. registry 的 `detect` 是扫描器的输入，不是装饰。

### 4.3 检测器

`check-reuse.mjs` 两种模式：

**模式 A：签名命中（快）**

| 能力                      | 命中特征                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| `useRequest`              | `useEffect` + `setLoading/setIsLoading/setLoadState` + `setError`       |
| `useAsyncAction`          | `setIsSubmitting/setPending/setIsPending` + `try/finally`               |
| `useDebouncedValue`       | `setTimeout` + `clearTimeout` 出现在 `use*` 文件                        |
| `useDisclosure`           | `isOpen` + `setIsOpen` / `setOpen`                                      |
| `usePagination`           | `page`/`pageSize` + `setPage`（新增原语）                               |
| `useMediaQuery`           | `matchMedia`（新增原语）                                                |
| `useCopyToClipboard`      | `navigator.clipboard`（新增原语）                                       |
| `useIntersectionObserver` | `new IntersectionObserver`（新增原语）                                  |
| `api-client`              | `fetch(` / `axios` / 手拼 base URL，出现在 `features/**/services/**`    |
| `formatters`              | `Intl.NumberFormat` / `Intl.DateTimeFormat` / `dayjs` / `date-fns` 重复 |

**模式 B：函数体相似（准）**

用项目已有的 `typescript` 依赖解析 TS/TSX，抽取 `>= 15` 行的函数/箭头函数，做 token 归一化（标识符→`$id`、字面量→`$lit`、去注释/空白），对跨文件函数体做哈希与相似度分组。命中即报：

```text
src/features/a/hooks/use-x.ts:20-48 与 src/features/b/hooks/use-y.ts:18-46 函数体相似度 0.94
建议：抽到 src/shared/hooks/... 或复用 <capability-id>
```

误报用 `.agents/reuse-exceptions.json` 记录，字段 `pathA/pathB/reason/owner/expiresAt`。

### 4.4 生成器与流程

- `pnpm gen:hook use-foo`：生成 `src/shared/hooks/use-foo.ts`、测试、registry 条目、docs 行；在骨架仓库里写 `shared-assets/` 后跑 `materialize`。
- `pnpm gen:service <feature> <name>`：只生成调用 `apiRequest` 的 service，不生成 `fetch`。
- `pnpm check:reuse --suggest "<意图>"`：按 registry 的 `purpose/replaces/detect` 返回候选，AI 先跑再写。
- `templates/frontend/feature-hook.md`：展示「组合原语」而不是「重写状态机」。
- `AGENTS.md` 增加 always-on：**写任何 hook/service/component 前，先查 `capabilities.json`；新增共享能力必须登记 registry 并带测试。**
- `skills/initialize-*` 和 `sync-architecture-rules` 增加一句「同步后跑 `check:reuse`」，避免初始化/同步后资产缺失。

### 4.5 验收

- 在 feature 里写 `setTimeout` 去抖 → `check:reuse` 失败并提示 `useDebouncedValue`。
- 写一份和另一个 feature 90% 相同的函数 → 失败并给出相似度与建议。
- 新增共享 hook 未登记 registry → 失败。
- 正常组合 `useRequest` + `useAsyncAction` → 通过。

## 5. 问题四：通用 UI

### 5.1 事实

- shared UI 只有 7 个：`async-state`、`button`、`empty-state`、`field-row`、`page-header`、`stat-card`、`status-pill`（`shared-assets/src/shared/components/ui/`）。
- 没有 `index.ts` 统一出口；业务只能按文件路径深引。
- SPA 业务页在直接写原生控件：
  - `login-page.tsx:28,39` 两个 `<input>`；
  - `order-queue-section.tsx:81` `<input>`、`:88` `<select>`、`:159` `<button>`；
  - `dashboard-page.tsx:34` `<button>`；
  - `app-shell.tsx:25` `<button>`。
- SSR 业务页直接引 MUI：
  - `showcase-panel.tsx:3-7` 引 `Card/CardContent/Chip/Stack/Typography`；
  - `locale-switcher.tsx:3-4` 引 `MenuItem/TextField`；
  - `showcase-page.tsx:1-3` 引 `Container/Stack/Typography`。
- `ui-style-and-components.md` 让派生项目自建 `ConsoleButton/ConsoleModal/...`，等于官方承认「骨架不提供，你们自己长」。

### 5.2 设计：薄封装 MUI，单一出口，分层准入

不引入第二套组件库。SPA/SSR 都已用 MUI，正确做法是**把 MUI 收进 `shared/ui`，业务只用语义化原语**：

```text
src/shared/components/ui/
  index.ts                 # 唯一出口
  button.tsx               # 已有
  icon-button.tsx          # 新增
  link-button.tsx          # SSR 已有，SPA 补
  text-input.tsx           # 新增（MUI TextField）
  text-area.tsx            # 新增
  select.tsx               # 新增（MUI Select + FormControl）
  checkbox.tsx             # 新增
  radio-group.tsx          # 新增
  switch.tsx               # 新增
  form-field.tsx           # 新增（label/error/helper 布局）
  dialog.tsx               # 新增（确认/表单外壳）
  drawer.tsx               # 新增（可选）
  table.tsx                # 新增（表格壳 + 空态 + pending）
  pagination.tsx           # 新增
  alert.tsx                # 新增
  snackbar.tsx             # 新增
  skeleton.tsx             # 新增
  spinner.tsx              # 新增
  tooltip.tsx              # 新增
  card.tsx                 # 新增
  badge.tsx                # 新增
  status-pill.tsx          # 已有
  empty-state.tsx          # 已有
  page-header.tsx          # 已有
  stat-card.tsx            # 已有
  field-row.tsx            # 已有
  async-state.tsx          # 已有
```

准入原则：

1. 只做**薄封装**：透传 MUI props，统一 token、a11y 默认值、pending/disabled/error 语义，不写业务逻辑。
2. 组件不接受业务枚举/文案；`tone` 用语义化联合类型，业务映射留在 feature。
3. 内置 a11y：`aria-label` 必填或从 children 推导、focus ring、键盘触发、`aria-busy`、`role="alert"`。
4. 每个原语一个测试 + catalog 条目；没有测试不允许进 `index.ts`。
5. `Console*` 这类产品视觉不放进通用原语；如果确实需要，放派生项目 `features/<module>/components/`，并登记为 feature 级，不进 `shared/ui`。

### 5.3 边界规则（可执行）

| 规则                                                                                                                      | 检查方式                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `features/**`、`app/**` 禁止原生 `button/input/select/textarea/table/dialog`                                              | ESLint `no-restricted-syntax` + `ui-boundary.test.ts`                |
| `features/**` 禁止直接 import MUI 交互组件（Button/TextField/Select/Dialog/Table/Tabs/Snackbar/Alert/Chip/Card/MenuItem） | ESLint `no-restricted-imports`                                       |
| 共享 UI 只能从 `@/shared/components/ui`（barrel）导入                                                                     | ESLint `no-restricted-imports` 的 `patterns` + 架构测试              |
| 不允许第二套 UI 根（`src/shared/ui`、`src/shared/public-ui`、web 的 `src/components/ui`）                                 | `ui-boundary.test.ts` 目录检查                                       |
| feature 内不允许出现通用组件名（`button.tsx`、`input.tsx`、`modal.tsx`、`table.tsx`、`empty-state.tsx`）                  | `ui-boundary.test.ts` 文件名扫描                                     |
| `shared/ui` 不得 import `@/features/**`、不得调用 `t()`                                                                   | 已有 `shared-ui-contract.test.ts`，保留                              |
| 每个导出必须在 `ui-catalog.json` 登记，且文档表格与文件一致                                                               | `ui-catalog.test.ts` 扩展为双向校验                                  |
| 业务页不允许散落十六进制品牌色                                                                                            | `check-ui.mjs` 扫描 `#[0-9a-fA-F]{3,8}`，允许 token/主题文件与白名单 |
| 图标按钮必须有可访问名称                                                                                                  | `eslint-plugin-jsx-a11y` + 组件测试                                  |

允许的例外：

- `src/shared/components/ui/**` 自身可以用原生标签/MUI；
- `src/app/global-error.tsx` 必须能在无 Provider 下渲染，允许原生标签；
- 测试文件、`@generated` 文件；
- 确需原生的场景（如 `input type="file"` 的隐藏 input）走 `.agents/ui-exceptions.json`，带 reason/expiry。

### 5.4 视觉治理

- `ui-style-and-components.md` 目前 148 行，混了「通用原语」「控制台视觉」「具体产品文案」。建议拆成：
  - `ui-foundation.md`：原语清单、token、a11y、原生标签禁令、MUI 边界（通用）。
  - `ui-console-patterns.md`：控制台密度、按钮 tone、表格列宽、弹窗动作区（变体/项目可选）。
- 字体、颜色、圆角、间距只从 `shared/theme/design-tokens.ts` 进入；页面不写第二套。
- 新增组件必须走 `pnpm gen:ui <name>`：生成组件、测试、`index.ts` 导出、catalog 条目、docs 行。

### 5.5 验收

- SPA 登录页、工作台、app shell 不再出现原生交互标签。
- SSR showcase/locale-switcher 不再直接 import MUI 交互组件。
- 在 feature 里写 `<button>` → `UI-001` 失败。
- 新增 shared UI 未登记 catalog → 失败。
- `pnpm test:architecture` 与 `pnpm lint` 全绿。

## 6. 问题五：其他缺失与优化

按「会不会造成事故」排序，而不是按「看起来是否完整」排序。

| 优先级 | 缺失                              | 现状                                                     | 建议                                                                |
| ------ | --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| P1     | 可访问性无门禁                    | 没有 `eslint-plugin-jsx-a11y`；shared UI 没有 axe 测试   | 加 ESLint 插件 + `vitest-axe`；图标按钮、Dialog、Table 必测         |
| P1     | API 契约漂移                      | `mock:check` 只校验 OpenAPI 可解析；DTO 手写，无漂移检查 | 增加 `check:contract`：OpenAPI schema 与 `src/types/dto` 字段对比   |
| P1     | 生产安全开关未强制                | `server-config` 只校验 URL/key（见 SEC-5）               | 启动期 fail-fast；prod 模板与 CI 双重校验                           |
| P1     | 依赖审计只在 CI                   | 本地 `quality:check` 不跑 audit                          | 加 `check:deps`；CI 必跑；新依赖 commit trailer                     |
| P2     | i18n 硬编码                       | 规则要求文案进 `src/locale`，无检查                      | `check:i18n` 扫描 JSX 文本/`placeholder`/`aria-label` 字面量        |
| P2     | 错误码/事件名无目录               | logger 有，但事件名散落                                  | `shared/observability/events.ts` + 扫描未登记事件名                 |
| P2     | 日志/PII 脱敏无测试               | 有 logger，无 redaction 断言                             | 单测覆盖 token/cookie/email/phone/authorization                     |
| P2     | 共享 formatter/date/currency 缺失 | 每个 feature 可能各写一份                                | `shared/utils/format.ts` + `check:reuse` 检测                       |
| P2     | 表单校验无统一方案                | 规则要求校验，无共享 `useForm`/schema                    | 统一 zod + `useForm`（或 MUI + zod resolver），但先确认是否引入依赖 |
| P2     | 测试覆盖率无阈值                  | `vitest run` 不设 coverage                               | shared hooks/components 先设 80%；逐步扩展                          |
| P2     | 构建体积/性能无预算               | 无 bundle budget                                         | `size-limit` 或 `vite build` 产物阈值；CI 失败                      |
| P2     | 权限模型/feature flag 无标准      | 规则只说「前端隐藏不是权限」                             | 后端权限码 + 前端 `can()` 统一入口；不把权限全集放 store            |
| P2     | 例外治理分散                      | 只有 `architecture-exceptions.json`                      | 统一 `security/reuse/ui/architecture` 四类例外，带 owner/expiry     |
| P3     | Monorepo 版本/发布                | workspace 有边界检查，无 changeset/version 策略          | 需要发版时再引入 changesets                                         |
| P3     | 文档/AGENTS 漂移                  | `materialize` 只保规则，AGENTS/README 不校验             | `check:docs` 校验命令、路径、版本号与真实文件一致                   |
| P3     | RN storage 缺口                   | 规则有 `src/storage/*`，骨架没有                         | 补 SecureStore/AsyncStorage wrapper 与测试（独立批次）              |

## 7. 载体矩阵（规则 / 骨架 / 脚本 / 技能）

| 载体 | 本次要改的内容                                                                                                       | 落点                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 规则 | 凭证 cookie 默认、XSS sink、postMessage/外链/iframe、CSP/CSRF/cookie、复用准入、UI 原语与原生标签禁令、其他缺口      | `rules/frontend/frontend-security.md`、`shared-capabilities.md`、`ui-style-and-components.md`、`store.md`、`quality-tooling.md`、`frontend-react.md` |
| 骨架 | SPA cookie 会话、shared UI 原语与 barrel、shared hooks/utils、SPA Nginx 安全头、SSR CSP nonce、prod 配置校验         | `skeletons/spa/**`、`skeletons/ssr/**`、`shared-assets/**`                                                                                           |
| 脚本 | `check-staged`、`check-security`、`check-reuse`、`check-ui`、`check-commit-evidence`、`check-contract`、`check:i18n` | `tools/project/scripts/**`、`shared-assets/src/test/architecture/**`                                                                                 |
| 技能 | 初始化/同步后跑新检查；写 feature 前查 registry；UI 生成器                                                           | `skills/initialize-*/SKILL.md`、`skills/sync-architecture-rules/SKILL.md`、新增 `skills/build-feature/SKILL.md`                                      |
| 文档 | 本方案、ADR 更新、迁移说明、负向测试清单                                                                             | `docs/plans/2026-11-25-five-optimizations.md`、`.agents/verification.md`、各 skeleton ADR                                                            |

## 8. 实施阶段

本次实施范围：**Phase 0（门禁）+ Phase 1（安全，含 SPA cookie 与深度 token 检测）**；Phase 2 复用体系暂缓；Phase 3 UI 与 Phase 4 其他缺口排后。

### Phase 0：门禁骨架（P0，1–2 天）

1. 新增 `check-staged.mjs`、`check-commit-evidence.mjs`、`check-security.mjs`、`check-ui.mjs`、`check-changed.mjs`。
2. 接线 `.husky/pre-commit`、`.husky/commit-msg`、新增 `.husky/pre-push`（增量）。
3. 扩展 `verify-gates.mjs`：校验钩子内容、脚本、quality 串联。
4. 加负向 fixture 测试：每个脚本至少一个必失败用例。
5. 例外 JSON（security/ui/architecture）与 UI catalog 落地（catalog 可在 Phase 3）。

### Phase 1：安全收口（P0，2–3 天）

1. SPA session 改 HttpOnly cookie；删 `token` 持久化；改 API client、auth service、路由守卫、mock、测试、ADR。
2. SPA Nginx 补 `/api/` 同源反代 + CSP/HSTS/frame-ancestors/Permissions-Policy/COOP/CORP。
3. SSR CSP nonce、prod 配置强制 CSRF/secure、cookie 测试。
4. `SafeHtml`/`JsonLd` 唯一出口；安全扫描允许名单。
5. `SEC-001` 深度 token 检测（对象字段/persist pick/partialize/JSON.stringify/Cookies.set）与 fixture。
6. 补 SEC-005/006/007/008/012/014/015 规则与测试。

### Phase 2：复用体系（暂缓）

> 2026-11-26 决策：本轮不实施。保留以下清单供后续讨论，不进入验收。
>
> 1. `capabilities.json` + registry 校验 + `check:reuse` 两种模式。
> 2. 补 `usePagination`、`useMediaQuery`、`useCopyToClipboard`、`useIntersectionObserver`、`shared/utils/format.ts`。
> 3. `gen:hook`/`gen:service` 与 `check:reuse --suggest`。
> 4. AGENTS、模板、技能、commit trailer 接入。
> 5. 把 SPA 现有 feature hook 作为正例，写一个反例 fixture。

### Phase 3：UI 基础（P1，3–4 天）

1. `index.ts` + `ui-catalog.json` + 双向校验。
2. Phase 1 原语：`TextInput`、`TextArea`、`Select`、`Checkbox`、`FormField`、`Dialog`、`Table`、`Pagination`、`Alert`、`Skeleton`、`IconButton`、`LinkButton`。
3. SPA 登录/工作台/壳层替换原生标签；SSR showcase/locale-switcher 改 shared UI。
4. ESLint 边界 + `ui-boundary.test.ts` + a11y 测试。
5. 拆分 `ui-foundation.md` 与 `ui-console-patterns.md`。

### Phase 4：其他缺口（P2，持续）

按第 6 节优先级逐项加检查，先做 a11y、API contract、deps、i18n、日志脱敏，再做覆盖率、bundle budget、权限/flag。

## 9. 验收与负向测试

每次改动至少跑：

```bash
node tools/materialize.mjs && git diff --exit-code
node tools/check-doc-links.mjs
node tools/check-init-smoke.mjs
(cd skeletons/spa && pnpm quality:check)
(cd skeletons/ssr && pnpm quality:check)
(cd skeletons/rn && pnpm quality:check)
```

负向测试必须进 CI（或脚本自测）：

| 用例                                                                      | 期望失败规则   |
| ------------------------------------------------------------------------- | -------------- |
| stage `.env.prod`                                                         | hygiene env    |
| stage 3 MB 二进制                                                         | hygiene binary |
| stage `localStorage.setItem('session', JSON.stringify({ userInfo }))`     | SEC-001        |
| stage `persist(..., { pick: ['userInfo'] })` 且类型含 `token`             | SEC-001        |
| stage `partialize` 返回 `authorityToken`                                  | SEC-001        |
| stage `Cookies.set('token', value)`                                       | SEC-001        |
| stage `dangerouslySetInnerHTML`                                           | SEC-002        |
| stage `eval(userInput)`                                                   | SEC-003        |
| stage `target="_blank"` 无 rel                                            | SEC-005        |
| stage `postMessage(data, '*')`                                            | SEC-006        |
| stage 业务页 `<button>`（Phase 3）                                        | UI-001         |
| stage feature 直接 `import Button from '@mui/material/Button'`（Phase 3） | UI-002         |
| stage 新增 shared UI 未登记 catalog（Phase 3）                            | UI-003         |

## 10. 风险与待确认

1. **SPA 后端契约**：SPA 只接受 HttpOnly cookie。网关与页面不同域时，由 Nginx 同源反代 `/api/`；不保留 Bearer 例外，也不引入 `SameSite=None` 跨域 cookie。落地前需要确认 Nginx 能透传 `Set-Cookie` 与 `X-Forwarded-*`。
2. **UI 库选择**：建议继续 MUI 薄封装，不引入 shadcn/Radix 第二套；如果团队想换，需先做视觉与迁移成本评估。
3. **commit trailer 接受度**：证据 trailer 会增加提交负担，但换来可审计。复用 trailer 随 Phase 2 暂缓；安全 trailer 仍建议保留。
4. **扫描误报**：token 检测基于类型/对象图，不是字面量正则，但仍会有动态赋值漏报或误报；必须提供 `security-exceptions.json` 与明确的非敏感 allowlist，且例外带过期时间。
5. **性能**：pre-commit 只做 staged 快扫；pre-push 只跑本次变更影响到的检查；全量架构测试只放 CI 或手动 `pnpm check:architecture:full`，不要把 `pnpm test` 全量塞进 pre-commit/pre-push。
6. **RN 范围**：RN 的 Paper 边界与 storage 规则比 Web 更成熟，但 `src/storage` 缺失；建议单独立项，不与 Web 五项混在一起。

## 11. 一句话执行建议

先做 Phase 0 + Phase 1：**让「token 以任何形式进 localStorage/sessionStorage（含 `userInfo.token`、persist `pick`/`partialize`、`JSON.stringify`、js-cookie）」「dangerouslySetInnerHTML」「业务页原生交互控件」「生产 CSP/CSRF 配置缺失」在提交或构建阶段失败**。复用体系按本次决策暂缓，不阻塞安全收口。

## 12. 实施进度（2026-11-26）

已落地：

- **提交门禁**：新增 `check-staged.mjs`、`check-commit-evidence.mjs`、`check-changed.mjs`、`check-security.mjs`；SPA/SSR 的 `pre-commit`、`commit-msg`、`pre-push` 已接线；`verify-gates` 从“文件存在”升级为检查钩子内容，SPA/SSR 35/35 通过，RN 26/26 通过。
- **深度 token 检测**：`SEC-001` 不再只看字面量，改为“存储 sink + 类型/上下文敏感字段”关联；已实测命中 dealkeys 的 `publicStore`(`pick: ['userInfo']`)、`uupaycard`(`authorityToken`)、`razer`(`partialize`)、`xbox`(`token`)、`stock-front`(`Cookies.set`)，并放过 `uupaycard-web-admin` 的服务端会话正例。
- **SPA cookie 迁移**：`session-store` 去掉 `persist`/`localStorage`，只保留内存 `status/user`；登录响应去掉 token；`apiRequest` 固定 `credentials: 'same-origin'` 且不再注入 `Authorization`；新增 `/auth/session` 水合与路由守卫；mock/ADR/规则/初始化器同步。
- **安全配置**：SPA Nginx 补 CSP/HSTS/frame-ancestors/Permissions-Policy/COOP/CORP；SSR `APP_ENV=prod` 强制 `SESSION_COOKIE_SECURE=true` 与 `CSRF_ENABLED=true`，并补 3 个配置测试。
- **pre-push 增量**：`check-changed.mjs` 按变更路径只跑受影响 eslint/安全扫描/架构测试/typecheck，不跑全量架构测试。
- **规则**：`frontend-security.md` 删除 Bearer 例外，补深层存储、Nginx 同源反代、`postMessage`/`_blank` 红线；`store.md`、`quality-tooling.md`、SPA 变体补段同步。
- **发布脚本**：新增 `scripts/build.sh` 与 `scripts/deploy.sh`（SPA/SSR 共用）；`deploy.sh` 支持 `--app-root`/`--release-root` 指定发布根目录、`release`/`rollback` 子命令、软链原子切换、健康检查、`--no-reload`；兼容解压后单目录 `bash deploy.sh` 的旧 PM2 模式。
- **回滚双入口**：`release` 支持 `releases/<id>` 已存在时省略 `--artifact`，校验后直接切 `current`，适配云效重跑历史脚本；`rollback` 独立处理“解析 previous/--to → 切换 → 健康检查 → reload/restart”，用于超过云效 30 天保留期、旧流水线、单机救火等场景。
- **发布手册**：`shared-assets/docs/deployment/symlink-release.md` 与 `no-symlink-release.md` 已物化到 SPA/SSR；两套流程都不依赖 `rsync`，固定目录 SPA 用 `cp -a` 合并，软链模式用 `tar` 解包。
- **回滚速查**：`shared-assets/docs/deployment/rollback-quick-reference.md` 汇总云效主机部署回滚语义、软链/无软链各模型服务器命令、回滚前后检查与禁止操作；已挂到两份发布手册和 SPA/SSR 的 `online-release.md`。
- **版本端点缓存治理**：新增 `shared-assets/docs/deployment/version-endpoint-cache.md` 与 `scripts/check-version-cache.mjs`；SPA/SSR watcher 改为每次请求带 `?_=<timestamp>`、`cache: no-store` 和缓存诊断；SSR 版本路由/两端 Nginx 补 `CDN-Cache-Control`/`Surrogate-Control`；`deploy.sh` 支持 `CDN_PURGE_CMD` 在发布/回滚后刷新 CDN。
- **P0 安全收口**：`SafeHtml`/`JsonLd` 作为 `shared-assets/src/shared/security/` 强制共享资产（唯一 sink、DOMPurify 固定配置、JSON-LD 转义、测试）；新增 `safeRedirect` 并替换 SPA 登录回跳；`check-security` 增加 SEC-008 公开 env 变量名扫描；BFF 响应默认 no-store 增加单测。
- **共享复用与 UI 设计**：新增 `docs/plans/2026-11-26-shared-reuse-and-ui-foundation.md`，覆盖 registry/检测/生成器/agent 流程，以及 SPA/SSR 统一、撤 Tailwind、原生 CSS + CSS 变量、UI catalog 与迁移阶段；UI 实施等前置决策。
- **UI 基础迁移**：SPA/SSR 已切换到 Ant Design 6 + 原生 CSS + `tokens.css`，共享 UI 统一到 `@/shared/ui`（`Input`/`Select` 为 facade，`Button`/`PageHeader` 等为 composite）；已移除 MUI/Emotion/Tailwind 依赖与配置，新增 `ui-stack` 边界测试，两端 build 通过。
- **SEO/多语言提交门禁**：新增 `check-seo-routing`、`check-seo-content`、`check-seo-runtime`；pre-commit 接入路由/语义检查，pre-push 映射 `seo-boundary`/`public-locale-routing`，CI 增加构建后真实 HTML/sitemap/robots/404 冒烟；补充 Google 语义化 HTML 规则（一个 h1/main、标题层级、描述性锚文本、图片 alt/尺寸、结构化数据一致性、canonical 200）。
- **SSR traceId 串联方案**：新增 `docs/plans/2026-11-26-ssr-trace-id-correlation.md`，定义 proxy/request-context/gateway/response/日志的 requestId、traceparent、tlogTraceId 链路、测试与实施顺序；代码实施待新 session 按方案执行。
- **第二批安全与 CI 收口（2026-11-26，见 §18）**：CSP 生产去掉 `script-src 'unsafe-inline'`，改为每请求 nonce（纯函数 `buildContentSecurityPolicy` + 运行时断言）；`SEC-012` 重定向唯一出口、`SEC-014` 出站 URL 同源/私网校验、`SEC-015` 用户态响应 no-store 与 `unstable_cache` 禁用，三条都进了 `check-security` 并有负向验证；monorepo 纳入质量矩阵（`pnpm check && pnpm build`），并修掉它暴露的 `apps/example-app` 缺 vitest 依赖。
- **P1 检查与日志**：pre-commit 增加 UI 边界、日志边界、i18n 硬编码、无障碍、架构分片；SPA 生产构建用 Terser `drop_console`，性能走 Performance API、营销走 dataLayer；SSR PM2 stdout/stderr 合并为单个 JSONL，BFF 补入口/上游请求/上游响应/出口日志，payload 脱敏且完整内容只进 debug。OpenAPI/Prism 契约按裁定不做强制提交校验。

尚未落地（按优先级）：

- Phase 3：无。ESLint 边界（UI-001 原生交互标签、UI-002 直引 antd/lucide）与 catalog 双向校验（UI-003）已在 §19 落地；`check-ui-boundary.mjs` 与 `src/shared/ui/index.ts` barrel 此前就已存在，本批补的是编辑器期与登记期的约束。
- Phase 1 剩余：无。`SafeHtml`/`JsonLd` 唯一出口、SSR CSP nonce、SEC-008/012/014/015 均已在 §18 落地（012/014/015 由 `check-security` 覆盖，008 早前已覆盖）。
- Phase 2：复用体系按 2026-11-26 决策暂缓。

## 13. 鉴权接口：为什么需要 `/auth/session`

### 13.1 结论

需要。HttpOnly cookie 只解决“凭证怎么带”，不解决“前端怎么知道当前是谁”。SPA 刷新后必须有一个服务端接口回答“这个 cookie 对应哪个用户、是否仍然有效”，否则只能靠首个业务请求 401 猜测，路由守卫和顶栏用户信息都会失真。

推荐接口：

```http
GET /api/auth/session
Cookie: __Host-<project>-session=...
Cache-Control: no-store

200 { "authenticated": true, "user": { "id": "...", "displayName": "..." } }
200 { "authenticated": false, "user": null }        # 没有 cookie
401 { "code": "session_expired" }                  # cookie 存在但已失效/被撤销
```

### 13.2 理由

1. **HttpOnly cookie 对 JS 不可读**。前端无法从 `document.cookie` 判断登录态，必须问服务端。
2. **路由守卫需要水合**。没有 `/auth/session`，刷新受保护页面时只能先渲染或先发业务请求；前者会闪登录/空数据，后者把 401 噪声扩散到每个页面。
3. **用户信息需要服务端事实源**。顶栏显示名、头像、当前账号类型不能从 localStorage 恢复；这些数据必须每次由服务端确认，避免过期快照。
4. **会话撤销/过期需要可见**。服务端可以在 `/auth/session` 返回 401，前端统一清内存态并跳登录；比等业务接口失败更可控。
5. **SSR 与 SPA 可以共用同一契约**。SSR 首屏可以直接读 cookie，但仍暴露同一 `/auth/session` 给客户端水合，避免两套身份逻辑。

### 13.3 `/session` 与 `/me` 的取舍

- 路由守卫和登录态水合只用 `/auth/session`，返回最小字段（`id`、`displayName`，需要时再加 `avatarUrl`），不返回权限全集、邮箱、手机号、内部角色。
- `/me` 可以作为“完整个人资料”接口，但不要让每个页面守卫都调用它：响应更大、PII 更多、缓存风险更高。
- 如果项目已经有轻量 `/me`，可以复用它作为 session 接口，但必须在契约中写清“只返回最小字段、no-store、不返回 token”。

### 13.4 安全要求

- `Cache-Control: no-store`，不允许 CDN/代理缓存。
- 响应体不含 token、refresh token、权限全集、内部密钥。
- 登录成功轮换 session id（防 fixation）；登出由服务端失效并清 cookie。
- 没有 cookie 返回 200 匿名态，避免控制台 401 噪声；cookie 存在但无效返回 401，便于统一清理。

## 14. 非 token 敏感信息：加密不是默认解

### 14.1 结论

**不建议**把“加密后可以存”作为通用规则。Web 端客户端加密不能抵御 XSS：只要解密密钥/能力对同源 JS 可见，XSS 就能调用解密；如果密钥放在 HttpOnly cookie，JS 又无法解密，业务就用不了。它最多降低“设备丢失/磁盘被翻”的风险，不改变“同源脚本可读”的事实。

### 14.2 分类处理

| 数据类别        | 示例                                       | 默认落点                                               |
| --------------- | ------------------------------------------ | ------------------------------------------------------ |
| 会话凭证        | token、refresh token、session id           | 只放 HttpOnly cookie，前端不读不存                     |
| 权限全集        | 菜单/按钮权限、角色、租户范围              | 服务端按会话返回；前端只保留当前页需要的投影，刷新重取 |
| PII             | 邮箱、手机号、地址、身份证、支付信息       | 不落浏览器存储；需要展示时从服务端取，内存保存         |
| 业务敏感数据    | 订单详情、账单、API Key、内部 ID           | 不落浏览器存储；短期内存缓存，刷新重取                 |
| 非敏感偏好      | locale、theme、currency、折叠状态、consent | 允许 localStorage/sessionStorage，走 allowlist         |
| 版本/防循环标记 | release id、刷新目标                       | 允许 sessionStorage                                    |

### 14.3 如果业务坚持要离线缓存

必须同时满足：

1. 有明确离线/弱网需求，不是“省一次请求”。
2. 数据分类为低敏感，且服务端可随时撤销。
3. 使用 WebCrypto AES-GCM + 非导出密钥，密文有 TTL，退出登录清除。
4. 在 ADR 记录残余风险：XSS 仍可调用解密、共享设备仍可读取、密钥轮换困难。
5. 不把 PII、权限全集、支付信息纳入离线缓存。

满足不了就退回“服务端会话 + 内存态”。

## 15. Nginx include 与 build/deploy 契约

### 15.1 Nginx：从“整份 server 块”改为“应用片段”

当前 `nginx.example.conf` 是完整 `server {}`，SPA/SSR 各自维护，线上无法直接 `include`。建议拆成：

```text
deploy/nginx/
  spa-locations.inc       # location = /<base>、/api/、index/version/assets、history fallback
  spa-security.inc        # CSP、XFO、HSTS、Referrer、Permissions、COOP/CORP
  ssr-proxy.inc           # location / 反代 Next standalone、Host/XFF/XFP、websocket、超时
  README.md               # 变量契约与 include 示例
```

线上由运维在自有 `server {}` 内 include：

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    # TLS、日志、限流由运维维护

    include /etc/nginx/app.d/<project-id>.inc;
}
```

必须守住的边界：

- 应用片段不写 `listen`、`server_name`、TLS 证书、日志路径；这些属于运维。
- 应用片段只写 location、proxy、缓存、安全头。
- `add_header` 在 Nginx 中“子 location 一旦自己 add_header 就不再继承父级”，所以安全头要么在每个 location 内 include，要么由生成器展开到每个 location；不能只在 server 级写一次就假设全部生效。
- SPA 的 `index.html`/`version.json` 用 `no-store`；`assets/**` 用 immutable；history fallback 落到 `index.html`。
- SSR 的 `location /` 反代到 `127.0.0.1:<port>`，转发 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto`、`Upgrade`/`Connection`；HTML 响应由 Next 自己设置 cache header。
- `/api/` 反代到网关时，Nginx **默认会透传 `Set-Cookie`**；不要配置删除/重写 `Set-Cookie`。cookie 用 host-only `__Host-` 前缀，`Path=/`，`Secure`、`HttpOnly`、`SameSite=Lax`；只有确需改 Path/Domain 时才用 `proxy_cookie_path`/`proxy_cookie_domain`，并写进交接单。
- TLS 在 Nginx 终止时，`X-Forwarded-Proto=https` 必须传；后端据此决定 cookie 是否加 `Secure`（生产应始终加）。

“最小前端可配结果集”是可行的，变量控制在：

```text
PROJECT_ID
BASE_PATH
STATIC_ROOT              # SPA
API_UPSTREAM             # /api/ -> gateway
APP_UPSTREAM / PORT      # SSR
CLIENT_MAX_BODY_SIZE
PUBLIC_HOST              # 仅用于生成注释，不写 server_name
```

`build.sh` 用这些变量渲染片段；运维只负责 include 和 TLS。

### 15.2 build.sh：一次构建，产出可部署制品

已新增 `scripts/build.sh`，SPA/SSR 同签名、不同实现：

```bash
scripts/build.sh --env prod --out dist
```

SPA 步骤：

1. `pnpm install --frozen-lockfile`
2. `pnpm check:gates && pnpm check:security`
3. `pnpm typecheck && pnpm lint && pnpm test`
4. `pnpm build:prod`
5. 校验 `dist/index.html`、`dist/version.json`、`dist/assets/**`
6. 生成 `dist/build-meta.json`（git SHA、构建时间、env、base path、artifact hash）
7. 渲染 `dist/deploy/nginx/spa-locations.inc`、`spa-security.inc`
8. 打包 `dist`（可选 tar.gz）

SSR 步骤：

1. 同上前四步（测试/门禁）
2. `pnpm build:dist:prod`
3. 校验 `server.js`、`.next/standalone`、`.next/static`、`public`、`ecosystem.config.cjs`
4. 生成 `build-meta.json`
5. 渲染 `deploy/nginx/ssr-proxy.inc`
6. 打包 `dist/`，不包含 `.env.*` 与真实 secret

`build.sh` 只负责“产生不可变制品”，不登录服务器、不 reload Nginx、不写生产 env。

### 15.3 deploy.sh：只部署同一份制品

> 无软链服务器的完整操作手册见 [`no-symlink-release.md`](../../shared-assets/docs/deployment/no-symlink-release.md)：SPA 用固定目录 + 入口原子替换，SSR 用版本目录 + PM2 `RELEASE_DIR`，都不依赖软链。
> 允许软链时见 [`symlink-release.md`](../../shared-assets/docs/deployment/symlink-release.md)：`deploy.sh release` 负责解包、切 `current`、健康检查、reload/restart；`deploy.sh rollback` 负责回滚，不建议只手工处理。

已新增 `scripts/deploy.sh`，接收制品、发布根目录与目标：

```bash
scripts/deploy.sh release --app-root /var/www/<app> --artifact <tar.gz> --release-id <id> [--no-reload]
scripts/deploy.sh rollback --app-root /var/www/<app> [--to <id>] [--no-reload]
```

SPA：

1. 校验 `build-meta.json` 与 artifact hash
2. 解压/rsync 到 `/var/www/<project>/releases/<release-id>`
3. 原子切换 `current` 软链
4. `nginx -t && nginx -s reload`（或 `--no-reload` 交给运维）
5. 失败回滚软链

SSR：

1. 校验制品
2. 解压到 `/opt/<project>/releases/<release-id>`
3. 注入 env（平台变量组/secret manager，不随制品）
4. 原子切换 `current`
5. `pm2 startOrReload ecosystem.config.cjs --update-env`
6. 健康检查通过后 `pm2 save`；失败回滚软链并 reload 旧版本

CI/CD 约束：

- build 一次，deploy 到多环境只提升同一 artifact，不在生产重新 build。
- `build-meta.json` 进入制品，deploy 校验后再上线。
- `deploy.sh` 必须幂等、可重入、失败可回滚；不在脚本里 `sudo`/`chown`/`chmod` 大范围改权限。
- Nginx reload 权限不足时用 `--no-reload`，由运维流水线执行；不要给应用账号 root。

## 16. SafeHtml、CSP nonce 与 SEC-008/012/014/015

### 16.1 SafeHtml / JsonLd 唯一出口

> 定位：这不是某个页面的一次性组件，而是**强制内置的共享安全能力**。应放在 `shared-assets/src/shared/security/`，随物化进入 SPA/SSR 的 `src/shared/security/`，而不是让每个项目自己实现。

问题：规则禁止 `dangerouslySetInnerHTML`，但富文本、Markdown 渲染、JSON-LD 确实需要写 HTML。如果每个 feature 自己 `DOMPurify.sanitize` 或自己拼字符串，等于把 XSS 评审分散到几十处，迟早有人漏掉。

做法：

- `src/shared/components/security/safe-html.tsx` 是唯一允许 `dangerouslySetInnerHTML` 的文件；内部固定 `DOMPurify.sanitize`，白名单标签/属性写死，不接受调用方传配置；禁止 `javascript:`/`data:` 协议；有 XSS 向量测试。
- `src/shared/components/security/json-ld.tsx` 是唯一允许内联 `<script type="application/ld+json">` 的出口；只接受服务端可控数据，序列化时把 `<`/`>`/`&`/U+2028/U+2029 转义，防 `</script>` 逃逸。
- 扫描器只允许这两个路径命中 SEC-002；其他任何 `dangerouslySetInnerHTML` 直接失败。
- 好处：XSS 评审集中到两个文件；业务不需要知道 sanitizer；升级/换库只改一处。

### 16.2 SSR CSP nonce

问题：当前 SSR CSP 生产仍是 `script-src 'self' 'unsafe-inline'`。`unsafe-inline` 让 CSP 对 inline script 基本失效；XSS 只要注入 `<script>` 就能执行。

做法：

1. proxy/middleware 每请求生成 `nonce = randomBytes(16).toString('base64')`。
2. 响应头写 `script-src 'self' 'nonce-<nonce>'; object-src 'none'; base-uri 'self'`。
3. 把 nonce 通过请求头传给 RSC/route，Next 读取后打到框架自身的 bootstrap/inline script 上。
4. 生产去掉 `script-src 'unsafe-inline'`；`style-src 'unsafe-inline'` 可暂时保留（Emotion/MUI 注入），并在文档说明它不是 script。
5. 测试：生产响应头含 nonce、不含 `unsafe-inline`；页面内联 script 带同一 nonce；nonce 每次请求不同。
6. 注意：JSON-LD 是 `type="application/ld+json"` 数据块，不受 `script-src` 约束，但仍要按 16.1 转义。

### 16.3 SEC-008/012/014/015 分别解决什么

| 规则                  | 问题                                                                                       | 做法                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-008 公开 env 泄密 | `VITE_*`/`NEXT_PUBLIC_*` 会进 bundle；有人把 `VITE_API_SECRET`、`NEXT_PUBLIC_TOKEN` 写进去 | 扫描公开前缀变量名与值：`SECRET/KEY/TOKEN/PASSWORD/PRIVATE`、高熵字符串；命中失败；只允许公开 origin、环境名、公开 flag                  |
| SEC-012 开放重定向    | `?redirect=https://evil.com`、`//evil.com`、`\evil.com` 把用户带去钓鱼站                   | 统一 `safeRedirect()`：只允许单斜杠站内相对路径；拒绝协议、`//`、反斜杠、编码绕过；单测覆盖                                              |
| SEC-014 SSRF          | BFF 按用户输入抓 URL（图片代理、导入、webhook），可打内网/metadata                         | 只允许 http/https；host allowlist；DNS 解析后拒绝私网/环回/链路本地/云 metadata；限制重定向次数、响应大小、超时；只允许 BFF/gateway 调用 |
| SEC-015 缓存串号      | 用户态响应被 CDN/代理缓存，A 的数据给 B；cache key 缺租户/用户/语言                        | 用户态默认 `Cache-Control: no-store`；公开可缓存端点显式 opt-in；cache key/tag 必含租户、用户、语言、权限维度；测试覆盖                  |

这些规则的共同点是：**不是“再写一段文档”，而是每条都要有可失败的扫描/单测和明确允许名单**。优先级建议：SEC-012/015（最容易造成真实事故）→ SEC-008（构建期即可拦）→ SEC-014（有 BFF 出站能力时再做）。

## 17. 下一批建议（CDN 暂缓）

> 共享复用与 UI 边界 + 基础原语的完整设计单独成文：[2026-11-26-shared-reuse-and-ui-foundation.md](./2026-11-26-shared-reuse-and-ui-foundation.md)。UI 实施等 SPA/SSR 统一、撤 Tailwind、MUI 去留确认后再开始。

CDN 缓存治理已经按“源站头 + 前端防御 + 刷新钩子 + 公网检查”落了一版；既然 CDN 侧暂不动，下面按“风险降低 / 实施成本”排序，只列不依赖 CDN 配置的部分。

### P0：建议下一批直接做

| 项                             | 为什么值得做                                                                                     | 成本     | 做法                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| SafeHtml / JsonLd 共享安全资产 | 富文本和 JSON-LD 是 XSS 高风险入口；现在是“规则禁止 + 各项目自己想办法”，迟早出现第二套 sanitize | 0.5–1 天 | 放 `shared-assets/src/shared/security/`，固定 DOMPurify 配置，唯一允许 sink；补 XSS 向量测试；扫描器允许名单收敛到该目录 |
| SEC-012 开放重定向             | `?redirect=https://evil.com` 是钓鱼高发点，当前只有零散 helper，没有统一检查                     | 0.5 天   | 统一 `safeRedirect()`：只允许单斜杠站内相对路径；拒绝协议、`//`、反斜杠、编码绕过；补单测和扫描                          |
| SEC-015 用户态缓存             | A 的页面/数据被 CDN 或代理缓存给 B，属于真实事故级问题                                           | 0.5 天   | 用户态默认 `no-store`；公开可缓存端点显式 opt-in；cache key 含租户/用户/语言/权限；补 BFF 响应头测试                     |
| SEC-008 公开 env 泄密          | `VITE_*`/`NEXT_PUBLIC_*` 会进 bundle，`VITE_API_SECRET` 这类错误一发生就是明文泄露               | 0.5 天   | 扫描公开前缀变量名/值中的 `SECRET/KEY/TOKEN/PASSWORD/PRIVATE` 与高熵字符串；构建期失败                                   |

### P1：紧接着做

> **2026-11-26 裁定**：OpenAPI/Prism 契约漂移**不纳入强制提交校验**。当前 AI Vibe coding 默认前后端一起跑，契约由 mock/openapi + 联调即时收敛；保留 `mock-contract` 架构测试作为 CI 参考，但不增加 pre-commit 强制项。

| 项                 | 为什么值得做                                                                                     | 成本   | 做法                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI 边界 + 基础原语 | 原第 4 项还没真正落地；业务页原生 `<input>/<select>/<button>`、SSR 直引 MUI 会造成第二套视觉语言 | 2–3 天 | `shared/ui/index.ts` 单一出口；先补 `TextInput/Select/TextArea/FormField/Dialog/Table` 等高频原语；ESLint 禁止 feature/app 原生交互标签和直引 MUI 交互组件；`ui-catalog` 双向校验 |
| SSR CSP nonce      | 生产 CSP 仍是 `script-src 'unsafe-inline'`，XSS 兜底基本失效                                     | 1–2 天 | proxy 每请求生成 nonce，Next 注入；生产去掉 `unsafe-inline`；补响应头/inline script 测试；`style-src` 暂留并注明原因                                                              |

### P2：有余力再做

- **a11y 基线**：`eslint-plugin-jsx-a11y` + shared UI 的 axe 测试；图标按钮、Dialog、Table 必测。
- **API 契约漂移**：OpenAPI schema 与 `src/types/dto` 字段对比，避免手写 DTO 和后端分叉。
- **i18n 硬编码**：扫描 JSX 文本、`placeholder`、`aria-label` 字面量。
- **依赖治理**：`pnpm audit` 进 CI；新依赖 commit trailer；SRI/许可证检查。
- **错误码/事件名目录 + 日志 PII 脱敏**：logger 有了，但事件名和脱敏断言还没固化。

### 暂不做 / 不建议现在做

- **CDN 侧改造**：已按你的决定暂缓；源站头和前端防御已经够用，等 CDN 团队能配规则/刷新再接。
- **共享复用体系**：按 2026-11-26 决定暂缓，等后续单独讨论。
- **一次性建完整 UI 组件库**：先做边界 + 高频原语，不要为了“组件齐全”造第二套设计系统。
- **Storybook/视觉回归/复杂 AST 复用检测**：等 UI 边界稳定后再投入。
- **完整权限模型/feature flag**：先保证“前端隐藏不是权限”的边界，再按业务需要引入。

### 建议的下一批组合

如果只做一批，建议：**SafeHtml/JsonLd + SEC-012/015/008**。这四项都不依赖 CDN、不依赖 UI 大改、都能配可失败检查，投入约 2 天，能直接把当前最实际的安全缺口补掉。

如果还能多给一周：**再加 UI 边界 + 基础原语**，把原第 4 项真正落地；CSP nonce 作为独立小批次，避免和 UI 改造混在一起。

## 18. 第二批实施记录（2026-11-26）

本批只做三件不依赖 UI 大改、不依赖 CDN 的事：SSR CSP nonce、SEC-012/014/015 的可失败检查、monorepo 纳入质量矩阵。下面记录与 §16 设计相比的落地决定，避免后来者按旧假设改。

### 18.1 CSP nonce 落地决定

- **抽取纯函数**：CSP 构造从 `proxy.ts` 抽到 `src/shared/security/content-security-policy.ts` 的 `buildContentSecurityPolicy(nonce)`，proxy 只负责生成 nonce 与写头。纯函数可单测，proxy 不再承担策略拼装。
- **nonce 生成**：proxy 每请求 `crypto.randomUUID()`（Edge runtime 没有 `randomBytes`），写入响应 CSP 的 `'nonce-…'`，并同步塞进请求头 `x-nonce` 供 RSC/客户端读取。Next 会解析响应 CSP 里的 nonce 并加到框架自身的 inline/bootstrap script 上。
- **生产去掉 `script-src 'unsafe-inline'`**；开发环境仍保留 `'unsafe-eval'`（React Refresh）。`style-src 'unsafe-inline'` 保留，理由是 **antd cssinjs 运行时注入**——原注释写「兼容 Emotion SSR 注入」已过期（MUI/Emotion 早已移除），本次一并清理。
- **JSON-LD 不受影响**：`<script type="application/ld+json">` 是数据块，不执行，不受 `script-src` 约束；仍按 §16.1 做转义。
- **验收**：`content-security-policy` 单测（有 nonce、无 `script-src 'unsafe-inline'`、两次请求 nonce 不同）+ 构建后的运行时断言（响应头含 `nonce-`，HTML 里 Next 的 inline script 带同一 nonce）。

### 18.2 SEC-012 重定向唯一出口

- 新增 `redirectToInternalPath(target, fallback)` 到 `shared-assets/src/shared/security/safe-redirect.ts`：先用 `safeRedirect()` 收敛成站内相对路径，再执行跳转。
- 扫描规则：`location.assign(`、`location.replace(`、`location.href =`、`document.location` 只允许出现在 `src/shared/security/safe-redirect.ts`；其余位置一律失败。`window.location.reload()` 与 `window.location.origin` 读取不属于重定向，不拦。
- `skeletons/ssr/src/shared/utils/auth-redirect.ts` 改为调用该 helper，同时消掉 Next 的 `no-location-assign-relative-destination` 告警。

### 18.3 SEC-014 出站 URL 校验

- 新增 `src/shared/security/outbound-url.ts` 的 `resolveOutboundUrl(baseUrl, path, { allowPrivateNetwork })`：
  - 只接受 `http:`/`https:`；
  - 用 `new URL(path, base)` 归并后**必须与 base 同源**（防 `//evil.com`、绝对 URL 逃逸，这是字符串拼接换成 `URL` 后最容易引入的洞）；
  - 拒绝带 userinfo 的 URL；
  - 非 mock/dev 环境拒绝环回、私网、链路本地、`*.local`、云 metadata 地址。
- `http-client.ts` 里两处 `fetch(url)` 的 url 统一由该函数产出；扫描规则：`src/bff/**` 禁止出现裸 `fetch(`（只允许 `http-client.ts`），也禁止用 `new URL(` 直接拼出站地址。

### 18.4 SEC-015 用户态缓存

两条可失败规则：

1. `Response.json(`/`NextResponse.json(` 只允许出现在 `src/bff/shared/http-response.ts`；其他位置出现时，同文件必须显式包含 `no-store`。当前 `health`、`version` 两个公开端点都自带 `no-store`，能过。
2. `unstable_cache(` 禁止出现在 `src/bff/**` 与 `src/app/**`：它就是「cache key 丢租户/用户维度」的高发点。公开只读缓存走 `createBffSuccessResponse({ cacheControl })` + CDN 头。

`revalidatePath`/`revalidateTag` 在 server action 里做失效属于合法用法（`locale-actions`、`showcase-action`），**不**纳入本规则，避免为了「严格」把正常写法判违规。

### 18.5 monorepo 纳入质量矩阵

- 模板按设计不带 `pnpm-lock.yaml`（各派生仓库自行解析，见 2026-11-25 决定），所以 CI 里 monorepo 用 `pnpm install`，不能 `--frozen-lockfile`；setup-node 的 pnpm 缓存只对有锁文件的变体启用。
- gate 用 `pnpm check && pnpm build`：`check` 聚合 workspace 边界、typecheck、lint、hygiene、test、format:check，`build` 补上「结构合法但跑不起来」的缺口。

## 19. Phase 3 实施记录（2026-11-26）

本批把 UI 边界从「只有 CI 脚本扫描」补成「编辑器期 + 提交期 + 登记期」三层，`UI-001/002/003` 从编号变成会失败的门禁。

### 19.1 UI-001 / UI-002：ESLint 边界

`eslint.config.js`（SPA 与 SSR 同步）新增一个只覆盖业务层的配置块：

- 覆盖范围：`src/{features,app,router}/**/*.{ts,tsx}`，排除 `global-error.tsx`、`error.tsx`、`app/providers*` 与测试。
- `no-restricted-imports`：禁止 `antd`、`antd/*`、`@ant-design/icons`、`@ant-design/nextjs-registry`、`lucide-react`（UI-002）。
- `no-restricted-syntax`：禁止原生 `<button>/<input>/<select>/<textarea>/<dialog>/<table>`（UI-001），用 esquery 选择器实现，不需要额外插件。

判定范围与 `scripts/check-ui-boundary.mjs` 保持一致：**脚本兜底 CI 全量扫描，ESLint 负责编辑器即时反馈**，两者允许名单相同（`src/shared/ui/**`、`src/shared/theme/antd-theme.ts`、`src/app/providers*`）。

### 19.2 UI-003：catalog 双向校验

`src/test/architecture/ui-catalog.test.ts` 原来只做「文档 → 代码」：catalog 里登记的组件必须存在。新增反向校验：`src/shared/ui/**.tsx` 每个文件都必须在 catalog 文档里出现，否则失败。

反向校验第一次运行就抓到真实漂移：SSR 的 `src/shared/ui/link-button.tsx` 从未登记。已补 `rules/ssr/ui-style-and-components-variant.md`（变体专属共享 UI 表），并明确反向校验看整篇文档——变体专属组件登记在末尾的变体补段里同样算数，否则通用表会逼迫 SPA 引用不存在的文件。

### 19.3 现状与遗留

- 两个变体当前 lint 全绿，说明现有业务代码本来就遵守边界；新增规则的作用是**防止回归**。
- `check-ui.mjs` 这个文件名没有落地：等价能力在 `check-ui-boundary.mjs`，已接在 pre-commit、pre-push 与 `quality:check` 中，不再另造一个同名脚本。

## 20. P2 批次实施记录（2026-11-26）

P2 组原文有五项，逐项核对后发现两项此前已经落地（i18n 硬编码扫描 `check-i18n-copy.mjs`、依赖改动的 `Dependency:` trailer 在 `check-commit-evidence.mjs`），本批补的是真正缺的四件。

### 20.1 API 契约漂移（新增 `check-contract-drift.mjs`）

- 读 `mock/openapi.yaml`（或 `mocks/openapi.yaml`）的 `components.schemas`，与 `src/{bff,types,shared}/**/dto/*.ts` 里的接口逐字段比对：字段集合、必填性、粗粒度类型。
- 匹配策略零误报优先：只在「schema 与 DTO 都存在」时比对；接口名按 `I<Schema>DTO` / `I<Schema>` 约定查找；信封内联负载用 `ALIASES` 显式登记（当前只有 `ShowcaseListResponse.data → IShowcaseListDTO`）。
- 引用类型按名字归一后比对（`IShowcaseItemDTO[]` 对 `ShowcaseItem[]`），避免大小写/前缀差异造成假失败。
- 已接入两个变体的 `quality:check` 与 `verify-gates` 必需脚本；SSR 侧为此补了 `yaml` devDependency（SPA 原本已有）。
- 负向验证：DTO 多一个 schema 未声明的字段时立即失败。

### 20.2 依赖审计进 CI

`quality.yml` 在安装后、构建前增加审计步骤，只对带锁文件的变体执行（monorepo 无锁文件，跳过）。

口径是 `pnpm audit --prod --audit-level=high`：**只卡运行时依赖**。全量审计实测在 spa 有 48 条（25 high）、
ssr 有 4 条（2 high），绝大多数来自 `eslint-plugin-react-hooks > zod`、`@stoplight/prism-cli > @faker-js/faker`
这类 devDependency —— 它们不进产物，把它们放进阻塞式门禁只会训练团队忽略红灯。dev 依赖的告警交给
Dependabot/renovate 跟踪。SPA/SSR 的骨架内 CI（派生项目用）同步改成同一口径。

上口径后 spa 仍有 2 条 high，是运行时真问题：`react-router >=7.0.0 <7.18.2` 命中两个公告
（GHSA-mrhx-c7xc-m3w5、GHSA-qwww-vcr4-c8h2）。已升到 `^7.18.7`，`pnpm audit --prod` 变为
"No known vulnerabilities found"，升级后完整 `quality:check`（含 build）通过。

### 20.3 事件名与日志 PII

- `check-logging.mjs` 增加一条硬规则：logger 的第一个参数必须是**字符串字面量**。模板拼接会让 SLS 上同一事件名无法聚合，告警规则也没法写死；负向验证用 `` `bff route ${id}` `` 触发失败。
- PII 断言此前已在同一脚本里（按 PII 词表扫描 logger 参数，并豁免 `hasSessionCookie` 这类布尔摘要字段），本批未重复实现。

### 20.4 无障碍基线

- 新增 `eslint-plugin-jsx-a11y`（SPA 与 SSR 的 devDependency），启用 `flatConfigs.recommended`；两个变体当前实现零违规，负向验证：无 `alt` 的 `<img>` 按 `jsx-a11y/alt-text` 失败。
- 既有的 `check-a11y.mjs` 静态扫描保留（img alt、非交互元素 onClick、图标按钮可访问名称），与 ESLint 形成提交期 + 编辑器双保险。
- **未做**：组件级 axe 测试。它不是「加个依赖」就能落地——axe 多数规则依赖真实布局，在 jsdom 里结果不可信，需要引入浏览器测试基础设施（Playwright 类）。这笔成本与收益需要单独决策，不以假绿的方式塞进质量门禁。

### 20.5 仍未覆盖

- `SRI` 与许可证检查：需要在构建产物层面接，且要先定「哪些依赖允许进入产物」的策略。
- 错误码/事件名**目录化**（把散落字面量收敛成常量表）：属于迁移型改造，动的是各业务调用点，应与事件命名规范一起排期，不适合和本轮门禁混做。

## 21. 大文件管控补口（2026-11-26）

复盘「大文件怎么管」时发现两个口子：一是 `maxTextBytes` 配了但脚本只读不用，二是 `--history` 从来没接门禁。本批只补前者，后者按决定不做。

### 21.1 `maxTextBytes` 真正生效

`check-repo-hygiene.mjs` 现在对**非二进制扩展名**的文件校验 `maxTextBytes`（默认 300 KB）：

- 锁文件按 basename 豁免——它是依赖解析产物，体积由依赖数量决定（RN 的 `pnpm-lock.yaml` 就有 391 KB）；
- 新增 `textSizeAllowList`（默认空）用于显式放行业务上确实需要的大文本（例如离线词典、长夹具），按路径前缀匹配；
- 2 MB 的 `maxFileBytes` 保留，两者分工不同：2 MB 防异常大文件，300 KB 防「几十上百 KB 的巨型源码/文档/夹具」逐步失控。

验证在**独立仓库副本**里做，因为 `--staged`/`--tracked` 走 `git diff --cached` / `git ls-files`，在 skeleton 子目录里拿到的是仓库根相对路径，会被路径拼接全部跳过、静默「通过」：

- 391 KB 的普通 Markdown → `--staged` 失败并报出体积；
- 391 KB 的 `pnpm-lock.yaml` → 通过（豁免生效）；
- 干净的工作区 → 通过（无误报）。

### 21.2 `--history` 不由门禁接管

历史大对象扫描（`git rev-list --objects --all` + `cat-file --batch-check`）保留为手动诊断命令，不接 CI。原因：仓库已经确定不引入 LFS、也不做历史重写，把一个「必然报警且无法在当次提交里修复」的检查放进 CI 只会制造长期红灯。

### 21.3 顺带记一个验证陷阱

骨架仓库里直接 `cd skeletons/<variant> && node scripts/check-repo-hygiene.mjs --tracked` 是**假通过**——git 返回的路径带 `skeletons/<variant>/` 前缀，`existsSync` 找不到文件就跳过。真正验证要复制到独立目录并 `git init`（本批即如此验证）。称职的结论只能来自后者。
