# SSR Security Baseline

## Goals

- SSR / BFF 项目默认面向公开网络设计；任何 Route Handler、Server Action、proxy/middleware、Server Component request API 都应被视为可被攻击者间接触达。
- 不通过关闭安全保护来"修复"功能问题；需要例外时必须记录原因、影响范围、补偿措施和过期条件。

## Generic Web Security

> 通用 Web 安全基线(CSP、安全头、CORS allowlist、输入校验、XSS/CSRF、重定向 allowlist、上传限制)按 OWASP/行业标准执行,本文只列项目专属决策。

## Production Baseline

- 生产环境必须运行 production build：`next build` + `next start`、`.next/standalone/server.js`、平台等价命令或 PM2 指向 production server；不得暴露 `next dev`，且必须设置 `NODE_ENV=production`。
- 公网自托管 Next 服务前应有 nginx、CDN、负载均衡、WAF 或等价 edge/reverse proxy，负责 TLS、请求体大小限制、慢请求防护、基础限流和静态资源缓存。
- SSR 生产部署必须声明 source map 策略：不上公网、仅上传到错误平台、或受控内网访问；不得把包含源码的 sourcemap 直接公开给匿名用户。

## Auth And BFF Boundary

> 三层鉴权链权威见 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)。

- 安全侧强调：BFF 绝不把浏览器 raw cookie 直接透传给后端作为身份凭证；浏览器到 BFF 的 httpOnly same-origin cookie 必须在 BFF 转换为 `authorization` 或项目等价服务端 header,后端不应看到原始 cookie。
- token、session id、权限全集、refresh token 不进入 Client Component props、JSON response、localStorage、sessionStorage、日志或 URL。
- 登录、登出、刷新 token、清 cookie 只在 BFF route/action facade 或 BFF shared helper 中实现。

## Outbound Boundary

> gateway 唯一出站权威见 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)

- 安全侧强调：BFF service/action/route facade 的真实出站请求只经 gateway；gateway 错误对象不得包含 token、cookie、密码、完整邮箱/手机号、后端堆栈或供应商敏感响应。
- 图片代理、远程抓取、导入 URL 等能力必须防 SSRF：限制协议、host、私网网段、重定向和响应大小。

## Cache And Data Leakage

- 登录态、权限态、租户态、账户、订单、支付、导出、后台操作页面默认 `no-store` 或动态渲染；不得被 static/ISR 缓存。
- cache key 和 tag 必须包含租户、语言、币种、权限或用户态维度；不能让用户 A 的数据被用户 B 命中。
- Route Handler 返回用户态数据时必须设置明确 cache header；代理层/CDN 不应缓存私有响应。
- `use cache`、ISR、tag cache、React cache 只缓存公开或按 key 明确隔离的数据。

## Verification

- 边界测试或静态扫描应覆盖：Client Component 不导入 server-only secret 模块；Route Handler/Server Action 有 runtime validation；cookie mutation 设置安全属性；敏感接口有 CSRF 或签名校验。
- 交付说明必须列出：security headers 来源、cookie/CSRF/CORS 策略、输入校验工具、敏感页面 cache 策略、source map 策略、仍未覆盖的安全例外。
