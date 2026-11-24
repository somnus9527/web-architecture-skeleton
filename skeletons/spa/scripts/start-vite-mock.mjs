import { spawn } from 'node:child_process';
import { Socket } from 'node:net';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const host = readRequiredEnv('MOCK_API_HOST');
const port = Number(readRequiredEnv('MOCK_API_PORT'));

/**
 * 读取必填环境变量，确保 mock 相关启动配置统一来自 .env.mock。
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
 * 等待 Prism 端口可连接，避免 Vite 页面先发请求时出现启动期代理错误。
 *
 * @returns Prism 端口可用后完成的 Promise。
 */
async function waitForPrism() {
  const startedAt = Date.now();
  const timeoutMs = 15_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(host, port)) {
      return;
    }

    await sleep(250);
  }

  throw new Error(`Prism mock server did not become ready at ${host}:${port}.`);
}

/**
 * 检测指定 TCP 端口是否可以连接。
 *
 * @param targetHost - 目标 host。
 * @param targetPort - 目标端口。
 * @returns 是否可以建立 TCP 连接。
 */
function canConnect(targetHost, targetPort) {
  return new Promise((resolve) => {
    const socket = new Socket();

    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(targetPort, targetHost);
  });
}

/**
 * 启动 mock 模式 Vite dev server。
 */
function startViteMock() {
  const child = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--mode', 'mock'], {
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

await waitForPrism();
startViteMock();
