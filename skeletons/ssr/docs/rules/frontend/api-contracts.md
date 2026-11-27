# API Contracts

## Style

- Use REST-style HTTP APIs unless the existing project already uses another HTTP style.
- Name paths around resources, not screens.
- HTTP methods follow the confirmed backend contract. The paired backend template defaults to `GET` for reads and
  `POST` for writes; externally owned or existing APIs keep their approved convention. Do not let frontend or BFF code
  invent a competing method style.
- New projects must create an OpenAPI contract for Prism mock. Markdown API docs remain the human-readable handoff.
- Existing projects without OpenAPI may stay Markdown-first until the user approves contract migration.
- Every frontend mock service method must have a matching API doc entry.
- Scaffold demo endpoints shipped inside the skeleton repository itself (the demo paths in `mock/openapi.yaml`, such
  as SPA `/workspace/*`、`/auth/*` 或 SSR `/health`、`/showcase`) are not business contracts: inside the skeleton they need no
  `docs/api/<module>.md` entry, but they must be marked as demo endpoints in the OpenAPI `info.description`. A
  project copied from the skeleton must replace them with the confirmed contract and then create the API docs
  required above; this exemption does not transfer to the derived project.
- Every new-project frontend service method must also map to the owning app's `mock/openapi.yaml` path + operation.
- In projects with Prism/OpenAPI mock support, every implemented frontend service method must map to the owning app's
  `mock/openapi.yaml` path + `operationId`; do not keep runtime mock endpoints only in TypeScript code.
- API docs may describe future endpoints only when they are explicitly marked `Planned`, `Not implemented in frontend`, or `Not available in Prism mock`.
- Split API docs by module. Use `docs/api/<module-name>.md` by default.
- Each endpoint must identify its module and contract owner. For an owned backend, also identify the backend service
  method, business rule IDs, and affected data objects; for external or not-yet-confirmed implementations, record
  `External`, `N/A`, or an Open Question instead of inventing details.

## Module API Document Structure

Each module API document should contain:

- Module metadata matching the backend doc.
- Endpoint index table.
- Shared DTO definitions used by more than one endpoint.
- Endpoint details.
- Error code table.
- Table impact summary.
- Frontend mock/service mapping.

Endpoint index template:

```markdown
## Endpoint Index

| API ID        | Method | Path           | Business Action | Service Method            | Data Objects       | Frontend Method |
| ------------- | ------ | -------------- | --------------- | ------------------------- | ------------------ | --------------- |
| API-MODULE-01 | POST   | /api/resources | 创建资源        | ResourceAppService.create | resource_record(W) | createResource  |
```

## Unified Response

Use this wrapper:

```json
{
  "data": {},
  "code": "200",
  "codeMsg": null
}
```

Rules:

- `code` is `"200"` on success；前端比较 `SUCCESS_CODE` 常量，不写裸 `'200'`。
- On failure, frontend displays `codeMsg` directly; do not require frontend translation when backend i18n is complete.
- Backend business return values should focus on business data; the framework wraps `data`, `code`, and `codeMsg`.
- Do not introduce a second response system.
- Frontend API clients must treat responses without `{ data, code, codeMsg }` as contract errors in remote/mock/dev/test/prod modes; do not silently wrap raw payloads as successful responses.
- Controller/service returns must not use raw `Map` for semantic response data; define response DTO/entity structures instead.

## Error Codes

业务错误码与前端归一错误码统一登记在 `src/shared/errors/codes.ts`，并生成可读目录 `docs/error-codes.md`：

- 命名：`dot.snake_case`（`common.network_error`、`bff.upstream_failed`、`auth.session_expired`）；禁止 `UPPER_SNAKE` 与裸字符串。
- 每个码必须声明 `httpStatus`、`owner`（`frontend` / `bff` / `backend`）、`messageKey`（无页面文案时为 `null`）与 `summary`。
- 代码里只能引用目录常量；`pnpm check:error-codes` 会扫描 `api-client` / `http-client` / `http-response` / BFF routes / gateway / transform
  里的裸 `code: '...'`，并校验 `docs/error-codes.md` 与代码一致。
- 改名或新增码：先改 `codes.ts`，再跑 `pnpm error-codes:table` 生成文档并一起提交；错误码是对外契约，改名要同步前端判断与告警。
- 后端下发的业务码（如 `auth.session_expired`）前端只做识别，不强行枚举全部后端码；前端自产码必须全部登记。
- SPA 的用户可见文案走 `code → locale key` 映射（`src/shared/errors/messages.ts`）；BFF 响应的 `codeMsg` 由后端或 BFF 提供，页面级文案仍走 locale。

## OpenAPI Contract

New projects must generate this structure under the project root for single-app projects, or under `apps/<app-name>/` for the owning app in monorepo projects:

```text
mock/
  openapi.yaml
  components/
    schemas/
    parameters/
    responses/
    requestBodies/
  examples/
```

Rules:

- `mock/openapi.yaml` is the Prism entry relative to the single-app root or owning app root, and references
  components/examples through `$ref`.
- Do not put all schemas and examples in the entry file.
- Keep schemas, requestBodies, responses, examples, frontend DTOs, and API docs aligned.
- Schemas consumed by frontend code must explicitly define nested object fields and array item fields. Avoid broad `type: object` with `additionalProperties: true` for consumed data unless it is an intentional extension bag and the reason is documented.
- Required fields, optional fields, enum values, error codes, and example payloads must match TypeScript DTOs and API docs.
- Cover normal, empty, business error, validation error, illegal transition, and permission/login examples when relevant.
- Keep DTOs under `src/types/dto/` and hand-write them from the contract by default. Do not introduce OpenAPI-generated DTOs unless the user asks.

## Auth And Headers

- Follow the confirmed authentication contract; do not invent credentials or transport in the frontend.
- Token-based contracts send the token through the approved `authorization` scheme and never persist production
  credentials in source code.
- Cookie/session contracts require Secure/HttpOnly/SameSite policy plus CSRF and Origin protection for state-changing
  requests.
- Include tenant, organization, merchant, or data-scope headers only when the business context requires them or the existing project already has them.

## Each Endpoint Must Include

- API ID with module prefix, such as `API-PAY-001`.
- Module ID.
- Interface name.
- Business purpose.
- HTTP method and path.
- Request headers.
- Path parameters, query parameters, and body parameters.
- Response field table.
- Error code table.
- Permission or data-scope requirements.
- Example request.
- Example response.
- Frontend mock/service method name.
- Related backend service method, external contract owner, or `N/A`.
- Related business rule IDs.
- Related data objects with access mode and migration file path, or `N/A`.
- Idempotency and transaction notes when the endpoint changes data.
- Cache impact when the endpoint reads from, invalidates, refreshes, or deliberately bypasses cache.
- MQ/event impact when the endpoint produces or depends on async processing.

## Pagination

List interfaces must document:

- Page number and page size parameter names.
- Sorting parameter names and default ordering.
- Filter fields and allowed enum values.
- Returned pagination structure.
- Empty-list response shape.

Prefer existing project pagination models such as `JaPageRespDTO` when they exist.

## State Change APIs

State-change interfaces must document:

- Allowed previous states.
- Target state after success.
- Idempotency key or duplicate-submit rule.
- Illegal transition error code and `codeMsg`.
- Audit/log record requirements.
- Cache invalidation or refresh rules.
- MQ/event produced after the transition, including topic/event ID and payload summary.
- Whether the operation needs confirmation in the frontend.
- Prism error examples for illegal transitions.

## Form APIs

Form workflows must document:

- Request DTO fields.
- Ant Design form component mapping (`Form.Item` + shared `Input`/`Select`).
- Frontend validation.
- Backend validation.
- OpenAPI `requestBody`.
- Validation failure example.

## Table Impact Summary

Every module API doc must include a table impact summary:

```markdown
## Table Impact

| API ID        | Data Read        | Data Written    | Notes        |
| ------------- | ---------------- | --------------- | ------------ |
| API-MODULE-01 | reference_record | resource_record | 创建资源记录 |
```

This summary must match the backend doc table usage matrix and the SQL files.

## Endpoint Template

Each endpoint entry must carry the blocks below. New projects should create an API document from the confirmed
upstream OpenAPI contract rather than copying the scaffold mock as a business source of truth.

Required per endpoint:

- Metadata line: API ID (`API-MODULE-01`), Module, Method, Path, Business, Frontend service, Backend service or owner,
  Rule IDs, Data Objects (with `(R)`/`(W)`), Migration Source, Auth.
- Idempotency / Transaction / Cache Impact / Event-MQ Impact — fill the value or state the reason it does not apply.
- Request Headers table (at least `authorization`).
- Request fields table: Field / Type / Required / Description.
- Validations table (Rule ID / Field / Rule / Error Code / codeMsg) when the endpoint validates input.
- Response `data` fields table.
- State Transition table (Current / Action / Target / Error When Illegal) for state-change endpoints.
- Errors table: code / codeMsg / Scenario.
- Example Request and Example Response JSON, both wrapped in `{ data, code, codeMsg }`.

## API Contracts（SSR 变体）

- BFF 与前端共享同一份 `mock/openapi.yaml`；BFF gateway 不得自创第二套方法风格或路径规则。
- BFF 的对外路由统一挂在 `/<project-id>-api/**` 下；前端只经 feature service 调用 `src/bff/services`，不直连 BFF 内部路径。
- server-only 的 DTO 与 gateway 实现不得进入浏览器可消费的包或 `src/shared`。
