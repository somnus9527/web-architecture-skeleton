## Delivery Verification（SPA 变体）

- **认证传输**：Vite SPA 通过各环境 `.env.<env>` 的 `VITE_API_BASE_URL` 切换 mock / dev / test / prod；
  mock 额外使用 `MOCK_API_TARGET`。token 或 cookie/session 的落地方式按 `frontend-security.md` 的凭证
  条款在交付说明中记录。
