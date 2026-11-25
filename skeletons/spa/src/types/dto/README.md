# API DTOs

OpenAPI 契约对应的 DTO 放这里，按模块拆文件，例如 `item.types.ts`。领域内部、仅 UI 使用的类型放
`src/features/<module>/types/`，不要混入 DTO。

本目录在骨架里保持为空；新模块接入真实契约时按 `docs/rules/frontend/api-contracts.md` 建立。
