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
 * 把变化最少的运行时依赖拆成独立 vendor chunk。
 *
 * 路由已经按页面 lazy 加载，但 React / React Router 会随入口常驻。单独切出来以后，
 * 业务代码每次发版只让入口 chunk 变哈希，vendor 命中长期缓存。
 *
 * 这里**故意不拆 antd**：按包名把 antd 归进一个 chunk，会把只在登录页用的
 * `antd/es/input` 从 lazy chunk 提升到首屏，首屏体积反而变大。让 Rolldown 按真实
 * 依赖图自行切分，lazy 页面仍然只带自己用到的组件。
 *
 * @param id - Rollup 模块 id。
 * @returns chunk 名；返回 undefined 时交给 Rolldown 默认策略。
 */
function splitVendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (/node_modules\/(?:react|react-dom|react-router|scheduler)\//u.test(id)) {
    return 'vendor-react';
  }

  if (/node_modules\/lucide-react\//u.test(id)) {
    return 'vendor-icons';
  }

  return undefined;
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
    // 生产包删除 console/debugger；性能事件走 Performance API，营销事件走 dataLayer，均不依赖 console。
    build: {
      minify: mode === 'prod' || mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: splitVendorChunk,
        },
      },
    },
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
