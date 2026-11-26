/**
 * trace 上下文纯函数。
 *
 * 设计定稿见 `docs/plans/2026-11-26-ssr-trace-id-correlation.md` §3：
 * - `requestId` 是 Next/BFF 的请求关联 ID，可沿用可信入口值；
 * - `traceparent` 是 W3C 分布式上下文，非法值必须丢弃并重建，不能透传；
 * - `tlogTraceId` 只来自后端响应头，客户端入站的同名头一律剥离。
 *
 * 本模块要能在 Edge runtime（proxy）里跑，因此只用 Web Crypto，不引 node:crypto。
 */

/** 出站/入站共用的 trace 上下文。 */
export interface ITraceContext {
  /** 请求关联 ID。 */
  requestId: string;
  /** 合法的 W3C traceparent，缺失时由本模块生成。 */
  traceparent: string;
  /** W3C tracestate，仅在 traceparent 合法时透传。 */
  tracestate?: string;
}

/** requestId 长度下界：太短不利于检索。 */
const MIN_REQUEST_ID_LENGTH = 8;

/** requestId 长度上界：避免日志被撑爆。 */
const MAX_REQUEST_ID_LENGTH = 128;

/** tracestate 长度上限，W3C 建议不超过 512。 */
const MAX_TRACESTATE_LENGTH = 512;

/** requestId 允许的字符集：header 安全且在 SLS 里可直接检索。 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/u;

/** W3C traceparent 严格格式。 */
const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/u;

/** 全 0 的 trace-id / parent-id 不合规。 */
const ZERO_TRACE_ID = '0'.repeat(32);
const ZERO_PARENT_ID = '0'.repeat(16);

/**
 * 校验并归一 requestId。
 *
 * @param value - 入站请求头里的值。
 * @returns 合法时返回去空格后的值，否则 undefined。
 */
export function normalizeRequestId(value: string | null | undefined): string | undefined {
  const requestId = value?.trim();
  if (!requestId) {
    return undefined;
  }
  if (requestId.length < MIN_REQUEST_ID_LENGTH || requestId.length > MAX_REQUEST_ID_LENGTH) {
    return undefined;
  }
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return undefined;
  }

  return requestId;
}

/**
 * 判断 traceparent 是否合法。
 *
 * @param value - 待校验值。
 * @returns 是否满足 W3C 格式且 trace-id/parent-id 非全 0。
 */
export function isValidTraceparent(value: string | null | undefined): value is string {
  const traceparent = value?.trim();
  if (!traceparent) {
    return false;
  }

  const match = TRACEPARENT_PATTERN.exec(traceparent);
  if (!match) {
    return false;
  }

  return match[1] !== ZERO_TRACE_ID && match[2] !== ZERO_PARENT_ID;
}

/**
 * 归一 tracestate：只在有值时保留，超长或含控制字符则丢弃。
 *
 * @param value - 入站 tracestate 值。
 * @returns 可透传的 tracestate。
 */
export function normalizeTracestate(value: string | null | undefined): string | undefined {
  const tracestate = value?.trim();
  if (!tracestate || tracestate.length > MAX_TRACESTATE_LENGTH) {
    return undefined;
  }

  // 控制字符会破坏 header，直接丢弃整条 tracestate。
  for (const character of tracestate) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return undefined;
    }
  }

  return tracestate;
}

/**
 * 生成合法的 W3C traceparent。
 *
 * @returns `00-<32hex trace-id>-<16hex parent-id>-01`。
 */
export function createTraceparent(): string {
  const traceId = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const parentId = toHex(crypto.getRandomValues(new Uint8Array(8)));

  return `00-${traceId}-${parentId}-01`;
}

/**
 * 由入站请求头解析 trace 上下文：可信值沿用，缺失或非法时生成。
 *
 * @param headers - 入站请求头。
 * @returns 本次请求的 trace 上下文。
 */
export function resolveTraceContext(headers: Headers): ITraceContext {
  const requestId = normalizeRequestId(headers.get('x-request-id')) ?? crypto.randomUUID();
  const inboundTraceparent = headers.get('traceparent');
  const traceparent = isValidTraceparent(inboundTraceparent) ? inboundTraceparent.trim() : createTraceparent();
  // traceparent 是我们自己重建的时候，tracestate 属于另一条链路，必须一起丢弃。
  const tracestate = isValidTraceparent(inboundTraceparent)
    ? normalizeTracestate(headers.get('tracestate'))
    : undefined;

  return tracestate ? { requestId, traceparent, tracestate } : { requestId, traceparent };
}

/**
 * 把字节数组转成小写十六进制。
 *
 * @param bytes - 随机字节。
 * @returns 十六进制字符串。
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
