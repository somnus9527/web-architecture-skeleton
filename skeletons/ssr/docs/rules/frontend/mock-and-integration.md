# Mock And Integration

> **Scope**: This file covers the mock + mock=>real contract shared by SPA and SSR. Framework-specific dev commands live in the variant note appended by materialize; the app root is `<frontend-root>` unless the project binding says otherwise.

## Prism And OpenAPI

- New projects use Prism + OpenAPI as the primary mock system.
- Create `mock/openapi.yaml` as the Prism entry relative to the single-app root or owning app root.
- For a large contract, split schemas/parameters/responses/requestBodies under `mock/components/` and example payloads under `mock/examples/`, then `$ref` them from the entry file. A small single-app contract may stay in one `openapi.yaml`; do not let the entry file become a dumping ground.
- All frontend service methods must map to a path + operation in the owning app's `mock/openapi.yaml`.
- Existing projects keep their current mock system unless the user approves migration.
- If a project has Prism/OpenAPI mock support, Prism is the only runtime mock path. Service, hook, page, API client, or component code must not return hardcoded mock response objects for HTTP/mock endpoints.
- Treat the owning app's `mock/openapi.yaml` as the source of truth for implemented frontend/API contracts. API docs
  may include future endpoints only when they are marked `Planned`, `Not implemented in frontend`, or
  `Not available in Prism mock`.
- Frontend-consumed schemas must define nested object fields and array item fields explicitly. Avoid broad `type: object` with `additionalProperties: true` for consumed data unless the field is intentionally an extension bag and the reason is documented.

## Mock Coverage

Prism examples must cover relevant workflow states:

- Normal data.
- Empty data.
- Business error.
- Form validation error.
- Illegal state transition.
- Permission or login-state failure.

Mock records, OpenAPI schemas, DTOs, API docs, service fields, and SQL semantics must use the same field meanings.
Required fields, optional fields, enums, state values, error codes, and example payloads must match across OpenAPI, DTOs, service payloads, API docs, and UI handling.

## Unified API Wrapper

`{ data, code, codeMsg }` 包装契约(string `code`、`code === "200"` 读 `data`、`code !== "200"` 直接显示 `codeMsg`、缺包装即契约错误、不得平行包装)权威定义见 [`./api-contracts.md`](./api-contracts.md),本文不重复。Mock 响应与 API 文档必须使用同一包装;分页优先复用既有模型如 `JaPageRespDTO`。

## Service Layer

- Put all mock or real API-facing methods in the service layer.
- Keep method names use-case-oriented and stable, such as `listResources`, `submitAction`, or `updateStatus`.
- In new projects, service methods call `src/shared/tools/api-client.ts` and never call `fetch` directly.
- In existing projects, use the existing request wrapper unless the user approves a migration.
- Simulate realistic loading and error states through Prism examples and UI state; do not hide contract errors in page components.
- Return error wrappers for validation failures, illegal state transitions, or mock exception scenarios.
- Use functional state updates in React when callbacks depend on previous state.
- Fixtures may remain for tests, stories, static examples, or OpenAPI example generation. They must not be imported by the runtime service path as a mock-mode fallback when Prism/OpenAPI mock support exists.

## Switching From Mock To Real API

Provide handoff steps when delivering a project:

1. Switch through the project env loader and dev script, not scattered code branches. Concrete variables and commands live in the variant note appended by materialize.
2. Use `src/shared/tools/api-client.ts` for new template projects, or replace service internals with the existing request wrapper; keep service method names and TypeScript DTOs stable.
3. Preserve the unified `{ data, code, codeMsg }` handling (canonical in [`./api-contracts.md`](./api-contracts.md)).
4. Apply the confirmed auth contract. For token-based APIs, use the approved `authorization` scheme and keep only
   local demo tokens in `.env.mock`; real credentials follow the credential storage clause in
   `./frontend-security.md`. For cookie/session APIs, implement the required credential mode, CSRF, Origin, and
   SameSite handling. Never commit production credentials.
5. Re-run OpenAPI validation, frontend checks, and manual tests for loading, success, failure, empty, validation error, and illegal transition states.

## Env Scripts

New projects should provide:

- `mock:serve` for Prism.
- `mock:check` or `openapi:check` for OpenAPI validation.
- `dev:mock` to run Prism together with the app dev server, using `.env.mock`.
- `dev:dev`, `dev:test`, and `build:prod` for `.env.dev`, `.env.test`, and `.env.prod`.

When a user asks to start the frontend project, use `dev:mock` by default if Prism/OpenAPI mock support exists and the script is available. After startup, if multiple `.env.*` files and matching dev scripts exist, report each environment's command to the caller, such as `mock -> pnpm dev:mock`, `dev -> pnpm dev:dev`, and `test -> pnpm dev:test`, and state which one is currently running.

## Mock And Integration（SSR 变体）

- 本骨架的 Next.js SSR/BFF 运行时使用服务端 gateway 规则，见
  [`ssr-contracts-and-mock.md`](./ssr-contracts-and-mock.md) 与 [`ssr-runtime-config.md`](./ssr-runtime-config.md)。
- 切换 mock 与真实上游要通过服务端 env 加载器与 gateway 配置完成，不在页面或组件里分支。
- 前端 service 方法、adapter 映射、gateway 边界与 DTO 名称在替换上游时必须保持稳定。
