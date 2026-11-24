## Frontend Security（SSR 变体）

以下随「有服务器」而来的攻击面,红线与细则见 [`ssr-security-baseline.md`](./ssr-security-baseline.md),此处仅列清单:

- **SSRF**: 服务端按用户输入抓取 URL(图片代理、导入、远程 fetch)必须限制协议、host 白名单、私网网段、重定向跳数与响应大小。
- **渲染注入转义**: 服务端把数据注入 HTML(如 `window.__INITIAL_STATE__`)必须 JSON 转义,防 `</script>` 逃逸;用 `serialize-javascript` 类库,不裸拼 `JSON.stringify`。
- **原型链污染**: 服务端合并请求参数/对象时防 prototype pollution。
- **缓存投毒 / 数据串号**: cache key/tag 必须含租户、语言、权限、用户态维度;私有响应 `no-store`,不被 static/ISR/CDN 缓存给他人。
- **资源耗尽**: SSR 渲染与 gateway 出站加超时 + 限流,防放大攻击。

---
