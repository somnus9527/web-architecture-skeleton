const PROD_ENV_FILE = `${__dirname}/.env.prod`;

try {
  process.loadEnvFile(PROD_ENV_FILE);
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}

const projectId = process.env.PROJECT_ID ?? 'ssr-app';
const appName = process.env.PM2_APP_NAME ?? `${projectId}-web`;
const logDirectory = process.env.PM2_LOG_DIRECTORY ?? `/data/logs/${appName}`;
const APPLICATION_ENV_KEYS = [
  'APP_ENV',
  'APP_ORIGIN',
  'BACKEND_API_BASE_URL',
  'CSRF_ENABLED',
  'LOG_LEVEL',
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_APP_ORIGIN',
  'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
  'PRISM_MOCK_BASE_URL',
  'SESSION_COOKIE_NAME',
  'SESSION_COOKIE_SECURE',
];

/**
 * 读取正整数型 PM2 参数，阻止无效值进入进程管理配置。
 *
 * @param {string} name - 环境变量名。
 * @param {number} fallback - 未配置时的保守默认值。
 * @returns {number} 已校验的正整数。
 */
function readPositiveInteger(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

/**
 * 读取 PM2 内存重启阈值，只接受带 K/M/G 单位的正整数。
 *
 * @returns {string} PM2 可识别的内存阈值。
 */
function readMaxMemoryRestart() {
  const value = process.env.PM2_MAX_MEMORY_RESTART ?? '768M';
  if (!/^[1-9]\d*[KMG]$/iu.test(value)) {
    throw new Error('PM2_MAX_MEMORY_RESTART must be a positive integer followed by K, M, or G.');
  }

  return value;
}

/**
 * 构造传给应用进程的显式环境白名单；项目额外 secret 必须通过 PM2_ENV_ALLOWLIST 逐项声明。
 *
 * @returns {Record<string, string>} 仅包含应用运行所需键的生产环境。
 */
function buildProductionEnv() {
  const additionalKeys = (process.env.PM2_ENV_ALLOWLIST ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  const allowedKeys = new Set([...APPLICATION_ENV_KEYS, ...additionalKeys]);
  const applicationEnv = {
    NODE_ENV: 'production',
    HOSTNAME: '0.0.0.0',
    PORT: process.env.PORT ?? '3001',
  };

  for (const key of allowedKeys) {
    const value = process.env[key];
    if (value !== undefined) {
      applicationEnv[key] = value;
    }
  }

  return applicationEnv;
}

const productionEnv = buildProductionEnv();

/**
 * 生产服务器内的 PM2 配置。
 *
 * 正式应用默认通过 PROJECT_ID 派生应用名，也可使用 PM2_APP_NAME 与
 * PM2_LOG_DIRECTORY 覆盖运维侧名称和日志目录。
 */
module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      kill_timeout: readPositiveInteger('PM2_KILL_TIMEOUT_MS', 30000),
      min_uptime: readPositiveInteger('PM2_MIN_UPTIME_MS', 10000),
      max_restarts: readPositiveInteger('PM2_MAX_RESTARTS', 10),
      exp_backoff_restart_delay: readPositiveInteger('PM2_RESTART_BACKOFF_MS', 100),
      max_memory_restart: readMaxMemoryRestart(),
      merge_logs: true,
      out_file: `${logDirectory}/${appName}-out.log`,
      error_file: `${logDirectory}/${appName}-error.log`,
      env: productionEnv,
      env_prod: productionEnv,
      env_production: productionEnv,
    },
  ],
};
