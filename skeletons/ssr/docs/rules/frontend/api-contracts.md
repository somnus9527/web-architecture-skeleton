# API Contracts

## Style

- Use REST-style HTTP APIs unless the existing project already uses another HTTP style.
- Name paths around resources, not screens.
- HTTP methods follow the confirmed backend contract. The paired backend template defaults to `GET` for reads and
  `POST` for writes; externally owned or existing APIs keep their approved convention. Do not let frontend or BFF
  code invent a competing method style.
- New projects must create an OpenAPI contract for Prism mock. Markdown API docs remain the human-readable handoff.
- Existing projects without OpenAPI may stay Markdown-first until the user approves contract migration.
- Every frontend mock service method must have a matching API doc entry.
- Every new-project frontend service method must also map to the owning app's `mock/openapi.yaml` path + operation.
- In projects with Prism/OpenAPI mock support, every implemented frontend service method must map to the owning app's `mock/openapi.yaml` path + `operationId`; do not keep runtime mock endpoints only in TypeScript code.
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

| API ID        | Method | Path                        | Business Action | Service Method            | Data Objects       | Frontend Method |
| ------------- | ------ | --------------------------- | --------------- | ------------------------- | ------------------ | --------------- |
| API-MODULE-01 | POST   | /<project-id>-api/resources | 创建资源        | ResourceAppService.create | resource_record(W) | createResource  |
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

- `code` is `"200"` on success.
- On failure, frontend displays `codeMsg` directly; do not require frontend translation when backend i18n is complete.
- Backend business return values should focus on business data; the framework wraps `data`, `code`, and `codeMsg`.
- Do not introduce a second response system.
- Frontend API clients must treat responses without `{ data, code, codeMsg }` as contract errors in remote/mock/dev/test/prod modes; do not silently wrap raw payloads as successful responses.
- Controller/service returns must not use raw `Map` for semantic response data; define response DTO/entity structures instead.

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

- `mock/openapi.yaml` is the Prism entry relative to the single-app root or owning app root, and references components/examples through `$ref`.
- Do not put all schemas and examples in the entry file.
- Keep schemas, requestBodies, responses, examples, frontend DTOs, and API docs aligned.
- Schemas consumed by frontend code must explicitly define nested object fields and array item fields. Avoid broad `type: object` with `additionalProperties: true` for consumed data unless it is an intentional extension bag and the reason is documented.
- Required fields, optional fields, enum values, error codes, and example payloads must match TypeScript DTOs and API docs.
- Cover normal, empty, business error, validation error, illegal transition, and permission/login examples when relevant.
- Keep DTOs under `src/types/dto/` and hand-write them from the contract by default. Do not introduce OpenAPI-generated DTOs unless the user asks.

## Auth And Headers

- Browser-to-BFF authentication follows the confirmed SSR session contract, normally using Secure/HttpOnly/SameSite
  cookies plus CSRF and Origin protection for state-changing requests.
- BFF-to-backend authentication uses the approved server-side token or service assertion and never exposes backend
  credentials to browser code.
- External APIs keep their approved authentication contract; do not invent credentials or transport.
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
- MUI form component mapping.
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

Each endpoint entry must carry the blocks below. For the full filled-in markdown skeleton (table headings and JSON shapes), copy an existing module doc such as [`../../api/<module>/story/<name>-api.md`](../../api/<module>/story/<name>-api.md) rather than re-typing the layout.

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
