import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * 读取当前源码提交的短 SHA，使自动生成的发版版本可追溯到构建源码。
 *
 * 源码包不包含 Git 元数据时使用 `no-git`，构建时间仍保证不同批次具有不同版本。
 *
 * @returns 当前提交的 12 位短 SHA，无法读取时返回 `no-git`。
 */
function getGitCommitShortSha() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0) {
    return 'no-git';
  }

  return result.stdout.trim() || 'no-git';
}

/**
 * 为本次生产构建生成不可变发版版本。
 *
 * @param appEnv - 当前业务环境。
 * @returns 由业务环境、Git SHA 与 UTC 构建时间组成的发版版本。
 */
function createDeploymentVersion(appEnv) {
  const gitCommitShortSha = getGitCommitShortSha();
  const buildTime = new Date()
    .toISOString()
    .replaceAll(/[-:TZ.]/gu, '')
    .slice(0, 14);

  return `${appEnv ?? 'app'}-${gitCommitShortSha}-${buildTime}`;
}

/**
 * 从 `.env.<env>` 文件名推断业务环境名，用于校验平台注入的环境变量是否匹配当前命令。
 *
 * @param envFile - 传入的 env 文件路径。
 * @returns 文件名中的业务环境名；无法识别时返回 undefined。
 */
function inferAppEnvFromFile(envFile) {
  return envFile.match(/^\.env\.(mock|dev|test|prod)$/u)?.[1];
}

/**
 * 优先加载本地 env 文件；文件不存在时要求平台已注入匹配的 `APP_ENV`。
 *
 * @param envFile - 需要加载的 `.env.<env>` 文件路径。
 */
function loadEnvFileOrInjectedEnv(envFile) {
  try {
    process.loadEnvFile(envFile);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  const expectedAppEnv = inferAppEnvFromFile(envFile);
  if (!expectedAppEnv || process.env.APP_ENV !== expectedAppEnv) {
    throw new Error(`Missing ${envFile}. Provide it locally or inject APP_ENV=${expectedAppEnv ?? '<expected-env>'}.`);
  }
}

/**
 * 加载指定 env 文件后启动 Next CLI，避免 `node --env-file` 被 Next build worker 继承。
 *
 * @param envFile - 需要加载的 `.env.<env>` 文件路径。
 * @param nextArgs - 传给 Next CLI 的参数列表。
 * @returns 子进程退出码。
 */
async function runNextWithEnv(envFile, nextArgs) {
  loadEnvFileOrInjectedEnv(envFile);

  const isProductionBuild = nextArgs[0] === 'build';
  const deploymentVersion = isProductionBuild
    ? process.env.NEXT_DEPLOYMENT_ID?.trim() || createDeploymentVersion(process.env.APP_ENV)
    : undefined;
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...nextArgs], {
    env: deploymentVersion
      ? {
          ...process.env,
          NEXT_DEPLOYMENT_ID: deploymentVersion,
        }
      : process.env,
    stdio: 'inherit',
  });

  if (deploymentVersion) {
    console.log(`Using deployment version: ${deploymentVersion}`);
  }

  return await new Promise((resolve) => {
    child.on('close', resolve);
  });
}

const [envFile, ...nextArgs] = process.argv.slice(2);

if (!envFile || nextArgs.length === 0) {
  throw new Error('Usage: node scripts/run-next-with-env.mjs <env-file> <next-args...>');
}

process.exitCode = await runNextWithEnv(envFile, nextArgs);
