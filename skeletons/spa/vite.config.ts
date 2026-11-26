import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

function normalizeBasePath(basePath?: string): string {
  const normalizedPath = basePath?.trim().replace(/^\/+|\/+$/gu, '');

  return normalizedPath ? `/${normalizedPath}/` : '/';
}

/**
 * 解析 dev server 端口，来自 `.env.<mode>` 的 `DEV_SERVER_PORT`。
 *
 * @param port - 原始端口配置。
 * @returns 合法端口号；未配置时返回 undefined，沿用 Vite 默认行为。
 */
function normalizeDevServerPort(port?: string): number | undefined {
  const normalizedPort = port?.trim();

  if (!normalizedPort) {
    return undefined;
  }

  const parsedPort = Number(normalizedPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error(`DEV_SERVER_PORT must be an integer between 1 and 65535, received: ${normalizedPort}`);
  }

  return parsedPort;
}

function frontendVersionPlugin(releaseId: string, basePath: string): Plugin {
  return {
    name: 'frontend-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ releaseId, basePath })}\n`,
      });
    },
  };
}

/**
 * Vite SPA 构建配置，集中注册 React、发布版本插件和源码 alias。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mockApiTarget = env.MOCK_API_TARGET;
  const devServerPort = normalizeDevServerPort(env.DEV_SERVER_PORT);
  const base = normalizeBasePath(env.VITE_APP_BASE_PATH);
  const releaseId = env.VITE_DEPLOYMENT_VERSION?.trim() || 'development';

  return {
    base,
    plugins: [react(), frontendVersionPlugin(releaseId, base)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: devServerPort,
      /**
       * 显式配置端口时禁止被占用后自动顺延，避免配置值与实际监听端口不一致。
       */
      strictPort: devServerPort !== undefined,
      proxy: mockApiTarget
        ? {
            /**
             * mock 模式只通过 Prism OpenAPI 服务取数，代理目标来自 .env.mock。
             */
            '/mock-api': {
              target: mockApiTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/mock-api/, ''),
            },
          }
        : undefined,
    },
  };
});
