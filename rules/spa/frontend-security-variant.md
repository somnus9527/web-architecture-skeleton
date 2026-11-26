## Frontend Security（SPA 变体）

- Nginx Web Root 必须是应用专用目录，`deploy.sh` 禁止同步到 `/`
- base path 外请求不应命中当前应用的 history fallback
- `index.html` 和 `version.json` 不缓存
- 生产 source map 不向匿名公网开放
- 网关与页面不同域时，Nginx 必须把 `/api/` 同源反代到网关，并透传 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto` 与 `Set-Cookie`；浏览器不得直连网关域名
- Nginx 应设置 CSP、`X-Content-Type-Options`、`frame-ancestors`、HSTS 和 Referrer Policy
- CORS 精确配置允许域名，不允许 `*` 与 credentials 同时使用
