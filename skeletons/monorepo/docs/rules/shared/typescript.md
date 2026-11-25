# TypeScript Naming Rules

> 前后端共享规范。本文件主要供前端使用;后端在 DTO / enum 命名讨论时可参考。

## Naming

1. `interface` 统一使用 `I` 前缀 + 语义大驼峰,例如 `IOrderDTO` / `IUserDTO`。
   Use the `I` prefix followed by a semantic PascalCase name.
2. `type` alias / enum / union 使用语义化大驼峰,**不加** `T` / `E` 前缀;枚举型联合、状态码、编码类型用业务名,如 `OrderStatus`、`PaymentChannel`、`AuditResult`。

## DTO 与 import

- DTO 名称与字段必须和 API 契约含义一致,**不能在前端发明业务字段**。
- 跨目录 import 使用项目 alias;同目录使用 `./`。

## Checklist

- [ ] interface 使用 `I` 前缀
- [ ] type / enum / union 无 `T` / `E` 前缀
- [ ] DTO 字段来自 API 契约
- [ ] 跨目录 import 用 alias
