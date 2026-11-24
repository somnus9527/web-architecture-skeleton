interface IAppEnv {
  appTitle: string;
  basePath: string;
  deploymentVersion: string;
}

function normalizeBasePath(basePath?: string): string {
  const normalizedPath = basePath?.trim().replace(/^\/+|\/+$/gu, '');

  return normalizedPath ? `/${normalizedPath}` : '/';
}

function readDeploymentVersion(): string {
  const deploymentVersion = import.meta.env.VITE_DEPLOYMENT_VERSION?.trim();

  if (deploymentVersion) {
    return deploymentVersion;
  }

  if (import.meta.env.DEV) {
    return 'development';
  }

  throw new Error('VITE_DEPLOYMENT_VERSION must be provided for production builds.');
}

/**
 * 浏览器可读取的构建期环境配置。
 */
export const appEnv: IAppEnv = {
  appTitle: import.meta.env.VITE_APP_TITLE?.trim() || 'SPA Application',
  basePath: normalizeBasePath(import.meta.env.VITE_APP_BASE_PATH),
  deploymentVersion: readDeploymentVersion(),
};
