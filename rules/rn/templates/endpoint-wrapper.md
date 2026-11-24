# Endpoint Wrapper Template

> 上级规则：`docs/rules/rn/api.md`。

## 适用场景

每个后端 operation 对应一个 endpoint wrapper。业务组件和 domain 不直接拼 URL，也不直接处理 envelope。

## 文件结构

```text
src/api/endpoints/
  <resource>.ts
src/domain/contracts/
  <resource>.ts
```

## Contract DTO

```ts
// src/domain/contracts/<resource>.ts
export type ItemDetailResponse = {
  id: string;
  name: string;
  updatedAt: string;
};

export type ItemListResponse = {
  items: ItemDetailResponse[];
  nextCursor?: string;
};
```

DTO 贴近后端响应 shape，可按 `docs/rules/rn/typescript.md` 的 DTO 豁免使用 `type`。

## Endpoint Wrapper

```ts
// src/api/endpoints/<resource>.ts
import { getJson, postJson, type ApiHelperOptions } from '@api/client';
import { ApiError } from '@api/errors';
import type { ItemDetailResponse, ItemListResponse } from '@domain/contracts/<resource>';

export interface IItemListQuery {
  locale?: string;
  keyword?: string;
  cursor?: string;
}

export interface ICreateItemRequest {
  name: string;
}

export type ResourceEndpointOptions = ApiHelperOptions;

interface IApiEnvelope<TData> {
  code: string;
  message: string;
  data: TData;
}

function unwrapEnvelope<TData>(envelope: IApiEnvelope<TData>): TData {
  if (envelope.code !== '0') {
    throw new ApiError(envelope.message, 200, envelope);
  }
  return envelope.data;
}

function buildQueryString(query: IItemListQuery): string {
  const params = new URLSearchParams();
  if (query.locale) params.set('locale', query.locale);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.cursor) params.set('cursor', query.cursor);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function getItems(
  query: IItemListQuery = {},
  options: ResourceEndpointOptions = {},
): Promise<ItemListResponse> {
  const envelope = await getJson<IApiEnvelope<ItemListResponse>>(`/api/items${buildQueryString(query)}`, options);
  return unwrapEnvelope(envelope);
}

export async function getItemDetail(id: string, options: ResourceEndpointOptions = {}): Promise<ItemDetailResponse> {
  const envelope = await getJson<IApiEnvelope<ItemDetailResponse>>(`/api/items/${id}`, options);
  return unwrapEnvelope(envelope);
}

export async function createItem(
  request: ICreateItemRequest,
  options: ResourceEndpointOptions = {},
): Promise<ItemDetailResponse> {
  const envelope = await postJson<IApiEnvelope<ItemDetailResponse>>('/api/items', request, options);
  return unwrapEnvelope(envelope);
}
```

## Smoke Test

```ts
// src/test/api/endpoints/<resource>.test.ts
import { getItemDetail } from '@api/endpoints/<resource>';

describe('getItemDetail', () => {
  it('unwraps successful envelope', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          code: '0',
          message: 'ok',
          data: { id: 'i1', name: 'Item', updatedAt: '2026-01-01T00:00:00.000Z' },
        }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await expect(getItemDetail('i1', { fetchImpl, baseUrl: 'https://api.example.com' })).resolves.toMatchObject({
      id: 'i1',
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/api/items/i1', expect.any(Object));
  });

  it('throws ApiError when envelope code fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 'BUSINESS_ERROR', message: 'Item not found', data: null }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    await expect(getItemDetail('missing', { fetchImpl, baseUrl: 'https://api.example.com' })).rejects.toThrow(
      'Item not found',
    );
  });
});
```
