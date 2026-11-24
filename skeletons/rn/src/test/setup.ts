// 测试环境固定使用 mock 后端地址，避免依赖本机 env 文件。
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080/api';
