import { z } from 'zod';

const deploymentVersionSchema = z.string().trim().min(1);

/**
 * 读取构建期固化的公开发版版本号。
 *
 * production 构建必须提供有效版本；development 使用固定占位值，且不挂载版本观察器。
 *
 * @returns 当前构建产物的不可变 release id。
 * @throws Error 当 production 构建产物缺少合法版本号时。
 */
export function getDeploymentVersion(): string {
  const parsed = deploymentVersionSchema.safeParse(process.env.NEXT_PUBLIC_DEPLOYMENT_VERSION);
  if (parsed.success) {
    return parsed.data;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'development';
  }

  throw new Error('Invalid deployment version: NEXT_PUBLIC_DEPLOYMENT_VERSION must be a non-empty string.');
}
