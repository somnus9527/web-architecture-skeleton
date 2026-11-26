# Frontend Security(前端安全红线)

所有前端工程(SPA 与 SSR/BFF)都要遵守的安全硬约束,分**必须(红线,违反即漏洞)**与**建议(纵深防御)**两档。红线正文保持通用可移植;本工程当前达标/待办集中在文末「本工程现状」一节。

SSR/BFF 专属增量(cache 投毒、出站边界、渲染注入转义、生产部署基线)由 SSR 变体补段承载;凭证与鉴权链的架构权威也在 SSR 变体中定义,本文不重复。

## 两条心智模型(先记这两条)

- **前端代码全部是公开的**——bundle、`NEXT_PUBLIC_*` / `VITE_*` 变量、source map 都会被用户看到。安全边界永远在后端,前端的路由守卫/按钮隐藏只是 UX,不是权限。
- **前端安全 90% 的工作量压在 XSS 及其兜底上**(CSP + 凭证隔离)。其余是纵深防御。

---

## 必须(红线)

### 1. XSS —— 头号威胁

- **禁止**用 `dangerouslySetInnerHTML` / `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` / `srcdoc` / `v-html` 直接写入任何含用户数据的字符串。
- 唯一允许的 HTML 出口是 `src/shared/security/safe-html.tsx`（固定 DOMPurify 配置）与 `src/shared/security/json-ld.tsx`（服务端可控数据 + 转义）；其他文件出现 sink 一律失败。框架默认插值(JSX `{}`、`{{ }}`)会转义,不要绕过它。
- 确需渲染富文本时,**必须**过白名单 sanitize(`DOMPurify` 等成熟库),禁止自己写正则黑名单。
- 结构化数据(JSON-LD)等确需内联 HTML 的场景,内容**必须**是服务端可控常量/字典,**禁止**混入任何用户输入。
- `href` / `src` / `formAction` 里的动态值**必须**校验协议,拒绝 `javascript:` / `data:` / `vbscript:` 等伪协议;拼 querystring 一律 `encodeURIComponent`。
- 禁止 `eval` / `new Function` / `setTimeout(字符串)` 执行动态字符串。
- `target="_blank"` 必须带 `rel="noopener noreferrer"`;`window.open` 必须带 `noopener`;`postMessage` 必须显式 `targetOrigin`,接收侧校验 `event.origin` 与 `event.source`,禁止 `'*'`。

### 2. 凭证存储与传输

- 会话凭证(token / session / refresh token)**必须**放 `HttpOnly` + `Secure` + `SameSite=Lax|Strict` Cookie,**禁止**放 `localStorage` / `sessionStorage` / IndexedDB / 非 HttpOnly cookie / JS 可读的全局变量——一旦 XSS 即等于凭证泄露。
- Web SPA 与 SSR **不提供 Bearer 回退**。网关与页面不同域时,由 Nginx 把 `/api/` 同源反代到网关,浏览器不直连网关域名,cookie 保持同源;不得用 `SameSite=None` 或 CORS credentials 替代。
- 禁止把含 token 的对象整体持久化（如 `userInfo`、`session`、`LoginResponse`）；即使当前 token 为 null，字段进入持久化结构也不可接受。`persist` 的 `pick`/`partialize`、自定义 storage wrapper、`JSON.stringify(session)`、`Cookies.set` 都按同一红线处理。
- 登录响应、`/auth/session` 与业务 JSON **禁止**返回 token;刷新后由服务端会话接口水合登录态。
- 凭证、权限全集、内部 id **禁止**进入 Client Component props、JSON 响应体、URL、日志、错误信息。
- 全站 **HTTPS**;承载会话的 cookie 必须 `Secure`,生产必开 HSTS。

### 3. CSRF

- 用 Cookie 自动承载会话时**必须**防 CSRF:第一道是 `SameSite=Lax/Strict`;所有**改状态的写操作**(POST/PUT/PATCH/DELETE)再叠加 CSRF Token(双提交 cookie 或同步 token)或 Origin/Referer 校验。
- 生产环境 **CSRF 开关必须为开**,且必须有真实校验实现(不是只读一个 flag);校验落在服务端可校验的边界：SSR 由 BFF route/action facade 或 shared helper 承担，SPA 由配套后端或网关承担，纯前端仓库不得用客户端 flag 冒充校验。
- 不允许用「Bearer 不自动携带」作为绕过 CSRF 的理由；Web 端只接受 cookie 会话，写操作必须做 Origin/CSRF 校验。

### 4. CSP 与安全响应头

- 生产响应**必须**下发以下头(应用层、Next proxy/middleware 或 edge/nginx/CDN 任一处稳定产出,并在交付说明里写清来源):
  - `Content-Security-Policy` —— 收敛 `script-src`,禁用 `unsafe-eval`;**避免 `unsafe-inline`**,这是 XSS 的兜底防线。
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`(或用 CSP `frame-ancestors`)—— 防点击劫持。
  - `Strict-Transport-Security` —— 生产强制 HTTPS。
  - `Referrer-Policy: strict-origin-when-cross-origin`
- SSR 应优先做**基于 nonce 的严格 CSP**(每请求生成 nonce 打到 inline script,随后移除 `script-src 'unsafe-inline'`),这是 SSR 相对纯静态 SPA 的优势,应当利用;nonce 必须在应用层/中间件生成,不能只靠 edge 兜底。需 nonce 化的是**框架自身的内联脚本**(如 Next 的 hydration/bootstrap);`style-src 'unsafe-inline'`(antd CSS-in-JS 样式注入)与 `<script type="application/ld+json">`(数据块,不受 `script-src` 约束)均与 `script-src` 的收敛无关,不要误把 JSON-LD 当作移除 `unsafe-inline` 的前置。

### 5. 敏感信息不落前端

- 任何密钥、私钥、后端 secret、内部服务地址**禁止**进入前端 bundle。`NEXT_PUBLIC_` / `VITE_` 前缀变量 = 明文公开,只放非敏感配置(公开 origin、环境名、公开可读的 feature flag)。
- 生产敏感 env(DB 连接串、对象存储密钥、加密主密钥)**禁止**写入任何 committed 文件,部署时库外注入。
- 生产构建的 source map **禁止**对匿名公网用户公开:不上公网、或仅上传错误平台、或受控内网访问,三选一并记录。

### 6. 依赖与供应链

- lockfile **必须**提交并锁版本;CI/合并前**必须**跑依赖漏洞扫描(`pnpm audit` 或等价 SCA),高危 CVE 阻断合并。
- **禁止**引入未经评估的新依赖来做一件小事;新增依赖记录来源与用途。
- CI **必须**接 secret 扫描(gitleaks 等),把「密钥进代码」在合并前拦下。

### 7. 权限边界在后端

- 每个数据读写**必须**在后端(或 BFF 回源的后端)做鉴权与越权校验(IDOR:校验资源属主 = 当前用户)。前端的路由守卫、菜单/按钮隐藏只是 UX,**不是**安全边界。
- BFF **禁止**把浏览器 raw cookie 透传给后端当身份;必须转换为服务端 header。

---

## 建议(纵深防御)

- **CORS 精确收敛**: `Access-Control-Allow-Origin` 精确到域名白名单,**禁止** `*` 配合 `credentials`。
- **SRI**: 引用 CDN 第三方脚本加 `integrity` 哈希,防 CDN 被投毒。
- **开放重定向**: 登录回跳、`redirect` / `next` 参数必须走 `src/shared/security/safe-redirect.ts` 的 `safeRedirect`；只允许单斜杠站内相对路径，拒绝 `//`、反斜杠、控制字符、伪协议和编码绕过。
- **公开 env**: `VITE_*` / `NEXT_PUBLIC_*` 名称中出现 `SECRET` / `TOKEN` / `PASSWORD` / `PRIVATE` / `CREDENTIAL` / `API_KEY` 等语义即失败，构建期扫描。
- **用户态缓存**: 用户相关响应默认 `Cache-Control: no-store`；公开可缓存端点必须显式 opt-in，cache key/tag 含租户、用户、语言、权限维度。
- **错误信息脱敏**: 返回给前端与前端上报的错误不带堆栈、SQL、内部路径、完整邮箱/手机号;生产关闭详细报错。
- **点击劫持二次确认**: 敏感操作(删除、支付、授权)加二次确认,配合 `frame-ancestors`。
- **限流与防自动化**: 登录、验证码、发送类接口做频控,前端配合行为验证/验证码。
- **自动化安全扫描**: 定期跑一次 DAST(OWASP ZAP 等)对公网入口做基线扫描。

---

## 交付自检清单(每次功能交付对照)

- [ ] 新增/改动的富文本、外链、`href`/`src` 无 XSS sink,动态 HTML 已 sanitize;内联 JSON-LD 无用户输入。
- [ ] 无凭证/密钥/内部 id 进入 client props、URL、日志、`NEXT_PUBLIC_*`。
- [ ] 新增写操作(POST/PUT/PATCH/DELETE)已被 CSRF/Origin 校验覆盖。
- [ ] 涉及的响应仍带安全头;新增内联脚本走 nonce。
- [ ] 新增服务端出站抓取已做 SSRF 校验。
- [ ] 新增数据读写在后端有越权(IDOR)校验。
- [ ] 新增依赖已过漏洞扫描,lockfile 已更新提交。
- [ ] 交付说明列出: 安全头来源、cookie/CSRF/CORS 策略、敏感页 cache 策略、source map 策略、未覆盖的安全例外。

---

## Frontend Security（SSR 变体）

- **Next.js Server Action 自带 CSRF 防护**：框架校验 `Origin` 与 `Host`/`X-Forwarded-Host` 匹配（可配
  `serverActions.allowedOrigins`），因此走 Server Action 的写操作（含登录）已满足 CSRF 红线，无需再手搓
  token。显式 CSRF/Origin 校验主要针对**被浏览器 fetch 调用的 Route Handler POST 面**。

以下随「有服务器」而来的攻击面,红线与细则见 [`ssr-security-baseline.md`](./ssr-security-baseline.md),此处仅列清单:

- **SSRF**: 服务端按用户输入抓取 URL(图片代理、导入、远程 fetch)必须限制协议、host 白名单、私网网段、重定向跳数与响应大小。
- **渲染注入转义**: 服务端把数据注入 HTML(如 `window.__INITIAL_STATE__`)必须 JSON 转义,防 `</script>` 逃逸;用 `serialize-javascript` 类库,不裸拼 `JSON.stringify`。
- **原型链污染**: 服务端合并请求参数/对象时防 prototype pollution。
- **缓存投毒 / 数据串号**: cache key/tag 必须含租户、语言、权限、用户态维度;私有响应 `no-store`,不被 static/ISR/CDN 缓存给他人。
- **资源耗尽**: SSR 渲染与 gateway 出站加超时 + 限流,防放大攻击。

---
