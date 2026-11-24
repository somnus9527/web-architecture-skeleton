# Frontend Security

## 红线

- 前端 bundle、`VITE_*`、source map 都按公开信息处理
- token、私钥、数据库连接、内部 secret 不得进入仓库或 `VITE_*` 等浏览器环境变量；浏览器存储中的凭证按「凭证存储与传输」条款处理
- 用户可控 HTML 必须经过可信 sanitizer，禁止直接使用 `dangerouslySetInnerHTML`
- 动态 URL、跳转地址和文件下载地址必须校验协议与目标
- 前端路由守卫和按钮隐藏只是 UX，真实鉴权与越权校验必须在后端完成
- API 错误不得直接向用户展示堆栈、SQL、内部路径或完整敏感字段
- lockfile 必须提交，新增依赖必须说明用途并经过供应链检查

## 凭证存储与传输

- 默认方案：在浏览器存储中持久化单个会话 token，适用于网关与页面跨域、没有 cookie 会话能力的常态部署
- 只有项目明确声明「网关与页面同源」时，才优先改用 `HttpOnly` + `Secure` + `SameSite` Cookie，并按契约补 CSRF/Origin 防护；同源声明与方案切换结论必须写入交付说明
- 采用浏览器存储持久化方案时，必须同时满足：
  - 载体默认 `localStorage`；只有明确要求「关闭标签页或浏览器即失效」时才用 `sessionStorage`，并在交付说明记录该选择；access token 与 refresh token 并存时只持久化 refresh，access 仅驻内存
  - token 有效期遵循后端 realm 的 TTL 上限，优先短 TTL + 服务端续活；没有续活能力时按到期重新登录处理，不得自行延长本地有效期
  - 登出、改密、账号禁用必须调用服务端撤销，不得只清除本地存储
  - 401/403、切换账号、发版迁移时必须清除持久化键与内存会话态
  - 只持久化 token 与最小用户标识；权限全集、用户敏感资料、服务端响应缓存不得持久化
  - 持久化键必须带版本号并支持迁移；读写只能经 session store 与 APIClient，业务组件不得散读存储
- 后端为单 active session（后登录覆盖前登录）时，必须在交付说明写明多标签页/多设备互踢是预期行为
- 上述条件缺任意一条即不得持久化凭证，退回仅内存会话
- 出现同源入口或后端具备刷新/轮换能力时重新评估，优先切回 `HttpOnly` Cookie

## SPA 发布安全

- Nginx Web Root 必须是应用专用目录，`deploy.sh` 禁止同步到 `/`
- base path 外请求不应命中当前应用的 history fallback
- `index.html` 和 `version.json` 不缓存
- 生产 source map 不向匿名公网开放
- Nginx 应设置 CSP、`X-Content-Type-Options`、`frame-ancestors`、HSTS 和 Referrer Policy
- CORS 精确配置允许域名，不允许 `*` 与 credentials 同时使用

## 自检

- [ ] 本次改动没有引入 secret 或真实凭证
- [ ] 凭证持久化符合「凭证存储与传输」条款（载体、TTL、服务端撤销、失效清理、键版本化）
- [ ] 富文本、链接、文件名和重定向已校验
- [ ] 后端接口有鉴权与资源属主校验
- [ ] 日志和错误提示已脱敏
- [ ] 新依赖已更新 lockfile
- [ ] 发布路径、缓存头和 source map 策略已确认
