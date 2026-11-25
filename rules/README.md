# Rules 分层

规则只有这一份源，`skeletons/<variant>/docs/rules/` 由 `tools/materialize.mjs` 生成。

| 层          | 用途                                                        | 物化到                                |
| ----------- | ----------------------------------------------------------- | ------------------------------------- |
| `shared/`   | 跨端共用（命名、注释、交付流程）                            | `docs/rules/shared/`                  |
| `frontend/` | SPA / SSR 通用前端规则                                      | `docs/rules/frontend/`                |
| `spa/`      | SPA 专属规则与变体补段（`*-variant.md` 追加到同名通用文档） | `docs/rules/frontend/`                |
| `ssr/`      | SSR 专属规则与变体补段                                      | `docs/rules/frontend/`                |
| `rn/`       | RN 规则；`rn/templates/` 是随规则交付的代码模板             | `docs/rules/rn/`（保留 `templates/`） |

## 约定

- 变体补段必须命名为 `<同名文档>-variant.md`，物化时追加到对应通用文档末尾。
- `{{placeholder}}` 由 manifest 的 `substitutions` 替换（例如 `{{mockDir}}`）。
- 直接改 `skeletons/*/docs/rules/` 会被 CI 打回：先生成、后提交。
- 变体层落点由 manifest 的 `variantLayerTarget` 决定：SPA/SSR 是 `frontend`，RN 是 `rn`（保留
  `templates/` 子目录）。
- 共享层由 `ruleLayers` 决定：RN 只声明 `["rn"]`，因此不继承 `shared/` 与 `frontend/`。
