import 'server-only';

import { cache } from 'react';

import type { IShowcaseListDTO } from '../dto/showcase-dto';

import { BffHttpClientError, requestBackend } from '@/bff/shared/http-client';
import { ERROR_CODES } from '@/shared/errors/codes';
import type { IRequestContext } from '@/bff/shared/request-context';

const SHOWCASE_ENDPOINT = '/showcase';

/**
 * 归一化的 showcase 出站错误，携带上游状态码与业务码。
 */
export class ShowcaseGatewayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly codeMsg: string;

  constructor(status: number, code: string, codeMsg: string) {
    super(codeMsg);
    this.name = 'ShowcaseGatewayError';
    this.status = status;
    this.code = code;
    this.codeMsg = codeMsg;
  }
}

/**
 * 判断未知值是否为可读取字段的普通对象。
 *
 * @param value - 待检查值。
 * @returns 是否为非空对象。
 */
function isShowcaseListDTO(value: unknown): value is IShowcaseListDTO {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as IShowcaseListDTO).items) &&
    typeof (value as IShowcaseListDTO).total === 'number'
  );
}

/**
 * 拉取 showcase 列表。BFF 唯一出站点；用 `React.cache` 做请求级去重。
 *
 * @param context - 请求上下文（requestId / locale / traceparent）。
 * @returns 校验后的 showcase 列表 DTO。
 * @throws ShowcaseGatewayError 上游非 2xx、业务码非成功或响应形状非法时抛出。
 */
export const fetchShowcaseList = cache(async (context: IRequestContext): Promise<IShowcaseListDTO> => {
  try {
    const data = await requestBackend<unknown, undefined>({
      cache: 'no-store',
      context,
      endpointId: 'showcase.list',
      method: 'GET',
      operationId: 'getShowcaseList',
      path: SHOWCASE_ENDPOINT,
    });

    if (!isShowcaseListDTO(data)) {
      throw new ShowcaseGatewayError(502, ERROR_CODES.BFF_MALFORMED_DATA.code, 'Showcase response data is malformed.');
    }

    return data;
  } catch (error) {
    if (error instanceof ShowcaseGatewayError) {
      throw error;
    }

    if (error instanceof BffHttpClientError) {
      throw new ShowcaseGatewayError(error.status, error.code, error.codeMsg);
    }

    throw error;
  }
});
