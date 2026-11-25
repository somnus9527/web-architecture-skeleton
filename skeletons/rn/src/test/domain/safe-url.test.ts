import { assertAllowedUrl, isAllowedUrl, parseAppLink } from '@domain/safe-url';

jest.mock('@domain/safe-url-config', () => ({
  APP_DEEP_LINK_SCHEME: 'testapp',
  ALLOWED_EXTERNAL_HOSTS: ['www.example.com'],
  ALLOWED_EXTERNAL_HOST_SUFFIXES: ['.cdn.example.com'],
}));

describe('isAllowedUrl', () => {
  it.each([
    ['https://www.example.com/foo', true],
    ['https://image.cdn.example.com/a.jpg', true],
    ['https://evil.com/foo', false],
    ['http://www.example.com', false],
    ['mailto:support@example.com', true],
    ['tel:+1234567890', true],
    ['testapp://pay/return', true],
    ['javascript:alert(1)', false],
    ['ftp://server', false],
    ['not a url', false],
  ])('isAllowedUrl(%s) === %s', (url, expected) => {
    expect(isAllowedUrl(url)).toBe(expected);
  });

  it('throws for disallowed URLs through assertAllowedUrl', () => {
    expect(() => assertAllowedUrl('https://evil.com')).toThrow('URL not allowed');
  });
});

describe('parseAppLink', () => {
  it('parses scheme, path and query', () => {
    const result = parseAppLink('testapp://external/return?requestId=req-1', 'testapp');

    expect(result?.pathname).toBe('/return');
    expect(result?.searchParams.get('requestId')).toBe('req-1');
  });

  it('returns null for a different scheme', () => {
    expect(parseAppLink('https://example.com', 'testapp')).toBeNull();
  });
});
