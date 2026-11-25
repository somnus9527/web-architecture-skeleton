import { readApiConfig } from '@api/config';

describe('readApiConfig', () => {
  it('should read and normalize the public env values', () => {
    const config = readApiConfig({
      EXPO_PUBLIC_ANALYTICS_ENABLED: 'yes',
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com/v1/',
      EXPO_PUBLIC_APP_ENV: 'staging',
    });

    expect(config).toEqual({
      analyticsEnabled: true,
      apiEnvironment: 'staging',
      apiBaseUrl: 'https://api.example.com/v1',
    });
  });

  it('should default analytics to disabled', () => {
    const config = readApiConfig({
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com',
      EXPO_PUBLIC_APP_ENV: 'test',
    });

    expect(config.analyticsEnabled).toBe(false);
  });

  it('should throw when the api base url is missing', () => {
    expect(() => readApiConfig({ EXPO_PUBLIC_APP_ENV: 'test' })).toThrow(/EXPO_PUBLIC_API_BASE_URL/u);
  });

  it('should throw when the app env is unknown', () => {
    expect(() =>
      readApiConfig({ EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com', EXPO_PUBLIC_APP_ENV: 'qa' }),
    ).toThrow(/EXPO_PUBLIC_APP_ENV/u);
  });

  it('should read the process env loaded by the test setup', () => {
    const config = readApiConfig();

    expect(config.apiEnvironment).toBe('test');
    expect(config.apiBaseUrl).toBe('http://127.0.0.1:8080/api');
  });
});
