// 测试环境固定使用 mock 环境与后端地址，避免依赖本机 env 文件。
process.env.EXPO_PUBLIC_APP_ENV = 'test';
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080/api';
process.env.EXPO_PUBLIC_ANALYTICS_ENABLED = 'false';

// AsyncStorage v3 不再随包提供 jest mock：这里用内存实现替代，测试不依赖原生模块。
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};

  return {
    __esModule: true,
    default: {
      clear: jest.fn(async () => {
        store = {};
      }),
      getAllKeys: jest.fn(async () => Object.keys(store)),
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
    },
  };
});
