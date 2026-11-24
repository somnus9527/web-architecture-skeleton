## Environments And Build（SPA 变体）

### 3.1 SPA(Vite,`--mode` 原生加载 `.env.<env>`)

```jsonc
{
  "dev": "pnpm dev:mock",
  "dev:mock": "concurrently -k \"pnpm mock:serve\" \"vite --mode mock\"",
  "dev:dev": "vite --mode dev",
  "dev:test": "vite --mode test",
  "build:test": "tsc -b && vite build --mode test",
  "build:prod": "tsc -b && vite build --mode prod",
  "preview": "vite preview",
}
```

- SPA 的 `VITE_*` 在 build 时烤进产物 → **每环境一份构建产物**(`build:test` / `build:prod`),
  不存在"一份产物多环境"。
- **不引入运行时 `config.json` 注入**:公共配置一律走构建期 `.env.<env>`,按环境分别构建。

## 静态产物

```text
dist/
  index.html
  version.json
  assets/
```

`dist/` 是 Vite 直接生成的完整静态产物，不做二次封装。`.env.*`、源码、测试、部署脚本和
开发依赖不进入 `dist/`。
