import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

function inferAppEnvFromFile(envFile) {
  return envFile.match(/^\.env\.(mock|dev|test|prod)$/u)?.[1];
}

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

function getGitCommitShortSha() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  return result.status === 0 ? result.stdout.trim() || 'no-git' : 'no-git';
}

function createDeploymentVersion(appEnv) {
  const buildTime = new Date()
    .toISOString()
    .replaceAll(/[-:TZ.]/gu, '')
    .slice(0, 14);

  return `${appEnv ?? 'app'}-${getGitCommitShortSha()}-${buildTime}`;
}

async function runViteWithEnv(envFile, viteArgs) {
  loadEnvFileOrInjectedEnv(envFile);

  const isBuild = viteArgs[0] === 'build';
  const deploymentVersion = isBuild
    ? process.env.VITE_DEPLOYMENT_VERSION?.trim() || createDeploymentVersion(process.env.APP_ENV)
    : undefined;
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...viteArgs], {
    env: deploymentVersion
      ? {
          ...process.env,
          VITE_DEPLOYMENT_VERSION: deploymentVersion,
        }
      : process.env,
    stdio: 'inherit',
  });

  if (deploymentVersion) {
    process.stdout.write(`Using deployment version: ${deploymentVersion}\n`);
  }

  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
}

const [envFile, ...viteArgs] = process.argv.slice(2);

if (!envFile || viteArgs.length === 0) {
  throw new Error('Usage: node scripts/run-vite-with-env.mjs <env-file> <vite-args...>');
}

process.exitCode = await runViteWithEnv(envFile, viteArgs);
