import { describe, expect, it } from 'vitest';

import {
  createTraceparent,
  isValidTraceparent,
  normalizeRequestId,
  normalizeTracestate,
  resolveTraceContext,
} from '@/shared/trace/trace-context';

const VALID_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

function headers(init: Record<string, string>): Headers {
  const instance = new Headers();
  for (const [key, value] of Object.entries(init)) {
    instance.set(key, value);
  }

  return instance;
}

describe('normalizeRequestId', () => {
  it('保留合法 requestId', () => {
    expect(normalizeRequestId('abc-123_DEF.456:7')).toBe('abc-123_DEF.456:7');
  });

  it.each([
    ['太短', 'abc'],
    ['超长', 'a'.repeat(129)],
    ['含空格', 'abc 12345'],
    ['含换行', 'abcdefgh\n1'],
    ['含非法字符', 'abcdefg$'],
    ['空值', '   '],
    ['null', null],
  ])('拒绝%s', (_label, value) => {
    expect(normalizeRequestId(value)).toBeUndefined();
  });
});

describe('isValidTraceparent', () => {
  it('接受标准 W3C 值', () => {
    expect(isValidTraceparent(VALID_TRACEPARENT)).toBe(true);
  });

  it.each([
    ['版本非 00', '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'],
    ['trace-id 太短', '00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01'],
    ['parent-id 太短', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b-01'],
    ['大写十六进制', '00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01'],
    ['全 0 trace-id', `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`],
    ['全 0 parent-id', `00-4bf92f3577b34da6a3ce929d0e0e4736-${'0'.repeat(16)}-01`],
    ['空值', ''],
    ['null', null],
  ])('拒绝%s', (_label, value) => {
    expect(isValidTraceparent(value)).toBe(false);
  });
});

describe('createTraceparent', () => {
  it('生成符合 W3C 格式的值', () => {
    expect(createTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
  });

  it('每次生成都不同', () => {
    expect(createTraceparent()).not.toBe(createTraceparent());
  });
});

describe('normalizeTracestate', () => {
  it('保留合法值', () => {
    expect(normalizeTracestate('congo=t61rcWkgMzE')).toBe('congo=t61rcWkgMzE');
  });

  it('超长丢弃', () => {
    expect(normalizeTracestate('a'.repeat(513))).toBeUndefined();
  });

  it('含控制字符丢弃', () => {
    expect(normalizeTracestate('a=b\nc')).toBeUndefined();
  });
});

describe('resolveTraceContext', () => {
  it('透传合法入站 requestId 与 traceparent', () => {
    const trace = resolveTraceContext(
      headers({ 'x-request-id': 'req-12345678', traceparent: VALID_TRACEPARENT, tracestate: 'congo=t61rcWkgMzE' }),
    );

    expect(trace.requestId).toBe('req-12345678');
    expect(trace.traceparent).toBe(VALID_TRACEPARENT);
    expect(trace.tracestate).toBe('congo=t61rcWkgMzE');
  });

  it('缺失时生成 requestId 与 traceparent', () => {
    const trace = resolveTraceContext(headers({}));

    expect(trace.requestId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(trace.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
    expect(trace.tracestate).toBeUndefined();
  });

  it('非法 traceparent 重建，并丢弃与之不匹配的 tracestate', () => {
    const trace = resolveTraceContext(headers({ traceparent: '00-bad', tracestate: 'congo=t61rcWkgMzE' }));

    expect(trace.traceparent).not.toBe('00-bad');
    expect(isValidTraceparent(trace.traceparent)).toBe(true);
    expect(trace.tracestate).toBeUndefined();
  });

  it('非法 requestId 回退为新生成的 UUID', () => {
    const trace = resolveTraceContext(headers({ 'x-request-id': 'bad id' }));

    expect(trace.requestId).not.toBe('bad id');
    expect(trace.requestId).toMatch(/^[0-9a-f-]{36}$/u);
  });
});
