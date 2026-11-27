import { ERROR_CODES, type ErrorCode } from './codes';

/**
 * 未登记错误码回落到的文案 key。
 */
const FALLBACK_MESSAGE_KEY = 'api.error.http';

/**
 * code → locale key 映射，来源是 `codes.ts` 里的 `messageKey`，避免两处维护。
 */
const MESSAGE_KEYS: Record<string, string> = Object.values(ERROR_CODES).reduce<Record<string, string>>(
  (map, meta: { code: ErrorCode; messageKey: string | null }) => {
    if (meta.messageKey) {
      map[meta.code] = meta.messageKey;
    }

    return map;
  },
  {},
);

/**
 * 把错误码解析成用户可见文案的 locale key。
 *
 * 未登记的后端业务码不回落到 codeMsg，因为文案由调用方决定；这里只负责前端兜底。
 *
 * @param code - 错误码，可能来自后端信封。
 * @returns locale key。
 */
export function resolveErrorMessageKey(code: string | null | undefined): string {
  return code ? (MESSAGE_KEYS[code] ?? FALLBACK_MESSAGE_KEY) : FALLBACK_MESSAGE_KEY;
}
