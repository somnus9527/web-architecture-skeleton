## API Contracts（SSR 变体）

- BFF 与前端共享同一份 `{{mockDir}}/openapi.yaml`；BFF gateway 不得自创第二套方法风格或路径规则。
- BFF 的对外路由统一挂在 `/<project-id>-api/**` 下；前端只经 feature service 调用 `src/bff/services`，不直连 BFF 内部路径。
- server-only 的 DTO 与 gateway 实现不得进入浏览器可消费的包或 `src/shared`。
