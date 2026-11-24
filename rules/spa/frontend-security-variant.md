## Frontend Security（SPA 变体）

- Nginx Web Root 必须是应用专用目录，`deploy.sh` 禁止同步到 `/`
- base path 外请求不应命中当前应用的 history fallback
- `index.html` 和 `version.json` 不缓存
- 生产 source map 不向匿名公网开放
- Nginx 应设置 CSP、`X-Content-Type-Options`、`frame-ancestors`、HSTS 和 Referrer Policy
- CORS 精确配置允许域名，不允许 `*` 与 credentials 同时使用
