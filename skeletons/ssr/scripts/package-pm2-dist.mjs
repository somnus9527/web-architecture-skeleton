import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');
const NEXT_STATIC_DIR = path.join(ROOT_DIR, '.next', 'static');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PM2_CONFIG_FILE = path.join(ROOT_DIR, 'ecosystem.config.cjs');
const DEPLOY_SCRIPT_FILE = path.join(ROOT_DIR, 'scripts', 'deploy.sh');

/**
 * 复制目录或文件到发布目录，保留 Next standalone 运行时需要的相对路径。
 *
 * @param sourcePath - 当前构建产物或部署配置的源路径。
 * @param targetPath - `dist` 发布包内的目标路径。
 * @returns 复制完成后的 Promise。
 */
async function copyIntoDist(sourcePath, targetPath) {
  await cp(sourcePath, targetPath, {
    recursive: true,
    force: true,
    errorOnExist: false,
    verbatimSymlinks: true,
  });
}

/**
 * 生成可整体部署的 PM2 发布包。
 *
 * 发布包包含 standalone 运行时、静态资源、PM2 配置与统一部署脚本。
 * 生产环境变量由 PM2、云效或平台运行时注入，不随发布包传输。
 *
 * @returns 发布包生成完成后的 Promise。
 */
async function packagePm2Dist() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(path.join(DIST_DIR, '.next'), { recursive: true });

  await copyIntoDist(STANDALONE_DIR, DIST_DIR);
  await copyIntoDist(NEXT_STATIC_DIR, path.join(DIST_DIR, '.next', 'static'));
  await copyIntoDist(PUBLIC_DIR, path.join(DIST_DIR, 'public'));
  await copyIntoDist(PM2_CONFIG_FILE, path.join(DIST_DIR, 'ecosystem.config.cjs'));
  await copyIntoDist(DEPLOY_SCRIPT_FILE, path.join(DIST_DIR, 'deploy.sh'));

  console.log('PM2 dist package created at dist/.');
}

await packagePm2Dist();
