import { spawn } from 'node:child_process';
import process from 'node:process';

const openApiPath = readRequiredEnv('MOCK_OPENAPI_PATH');
const host = readRequiredEnv('MOCK_API_HOST');
const port = readRequiredEnv('MOCK_API_PORT');

/**
 * 读取必填环境变量，避免 mock 服务启动时绕过 .env.mock 单一配置源。
 *
 * @param key - 环境变量名称。
 * @returns 环境变量值。
 */
function readRequiredEnv(key) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * 启动 Prism mock server，所有路径和端口配置都来自 .env.mock。
 */
function startPrismMock() {
  const child = spawn('pnpm', ['exec', 'prism', 'mock', openApiPath, '-h', host, '-p', port], {
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    throw error;
  });
}

startPrismMock();
