import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { parse } from 'yaml';

const OPENAPI_PATH = join(process.cwd(), 'mocks/openapi.yaml');
const REQUIRED_OPERATION_IDS = ['getWorkspaceDashboard', 'advanceWorkspaceOrder', 'login', 'logout'];

/**
 * 判断输入值是否是普通对象。
 *
 * @param value - 需要校验的未知值。
 * @returns 输入值是否可按对象读取字段。
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 从 OpenAPI paths 中收集 operationId。
 *
 * @param paths - OpenAPI paths 对象。
 * @returns 已声明的 operationId 集合。
 */
function collectOperationIds(paths) {
  if (!isRecord(paths)) {
    return [];
  }

  return Object.values(paths).flatMap((pathItem) => {
    if (!isRecord(pathItem)) {
      return [];
    }

    return Object.values(pathItem)
      .filter(isRecord)
      .map((operation) => operation.operationId)
      .filter((operationId) => typeof operationId === 'string');
  });
}

/**
 * 读取并解析 app 侧 OpenAPI mock 文件。
 *
 * @returns OpenAPI 文档对象。
 */
async function readOpenApiDocument() {
  const source = await readFile(OPENAPI_PATH, 'utf8');

  return parse(source);
}

/**
 * 执行 mock 契约结构校验。
 */
async function main() {
  const document = await readOpenApiDocument();

  if (!isRecord(document) || document.openapi !== '3.1.0') {
    throw new Error('mocks/openapi.yaml must be an OpenAPI 3.1 document.');
  }

  const operationIds = collectOperationIds(document.paths);
  const missingOperationIds = REQUIRED_OPERATION_IDS.filter((operationId) => !operationIds.includes(operationId));

  if (missingOperationIds.length > 0) {
    throw new Error(`Missing operationId: ${missingOperationIds.join(', ')}`);
  }

  if (!isRecord(document.components) || !isRecord(document.components.schemas)) {
    throw new Error('mocks/openapi.yaml must define components.schemas.');
  }
}

await main();
