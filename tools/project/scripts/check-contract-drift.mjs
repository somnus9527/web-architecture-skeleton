#!/usr/bin/env node
/**
 * API 契约漂移检查：OpenAPI schema 与前端 DTO 接口字段对齐。
 *
 * 目的不是替代契约测试，而是拦住最廉价、也最常见的漂移——后端加了字段、前端 DTO 没跟，或前端
 * 手写 DTO 与 schema 对不上，直到运行时才 500。
 *
 * 匹配策略（零误报优先）：
 * - 只在「schema 与 DTO 接口都存在」时比对，缺失的一侧不报错（开放契约不要求全量建模）；
 * - 接口名按 `I<Schema>DTO`、`I<Schema>` 两种约定查找；
 * - 信封内联的负载（如 `ShowcaseListResponse.data`）用 `ALIASES` 显式登记，避免猜。
 *
 * 用法：node scripts/check-contract-drift.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { parse } from 'yaml';

const ROOT = process.cwd();
const CONTRACT_CANDIDATES = ['mock/openapi.yaml', 'mocks/openapi.yaml'];
const DTO_ROOTS = ['src/bff/dto', 'src/types/dto', 'src/shared/types/dto'];

/**
 * 信封内联负载与 DTO 的显式映射。键是 `Schema` 或 `Schema.data` 形式的路径。
 */
const ALIASES = {
  'ShowcaseListResponse.data': 'IShowcaseListDTO',
};

/** OpenAPI 基础类型到 TypeScript 的粗粒度映射。 */
const TYPE_MAP = {
  string: 'string',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
};

const failures = [];

/**
 * 记录一条失败。
 *
 * @param {string} message - 失败描述。
 * @returns {void}
 */
function fail(message) {
  failures.push(message);
}

/**
 * 定位契约文件。
 *
 * @returns {string | null} 相对路径。
 */
function findContract() {
  return CONTRACT_CANDIDATES.find((candidate) => existsSync(join(ROOT, candidate))) ?? null;
}

/**
 * 收集 DTO 目录下的接口字段。
 *
 * @returns {Map<string, Map<string, string>>} 接口名 → 字段 → TypeScript 类型片段。
 */
function collectInterfaces() {
  const interfaces = new Map();

  for (const root of DTO_ROOTS) {
    const absolute = join(ROOT, root);
    if (!existsSync(absolute)) {
      continue;
    }

    for (const name of readdirSync(absolute).filter((entry) => entry.endsWith('.ts'))) {
      const source = readFileSync(join(absolute, name), 'utf8');
      for (const match of source.matchAll(/export interface (I?\w+)(?:<[^>]*>)?\s*\{([\s\S]*?)\n\}/gu)) {
        const [, interfaceName, body] = match;
        const fields = new Map();

        for (const line of body.split('\n')) {
          const field = /^\s{2}(\w+)\??:\s*(.+?);\s*$/u.exec(line);
          if (field) {
            fields.set(field[1], field[2].trim());
          }
        }

        interfaces.set(interfaceName, fields);
      }
    }
  }

  return interfaces;
}

/**
 * 读取 schema 的字段（支持内联对象与 `$ref` 数组）。
 *
 * @param {Record<string, any>} schema - OpenAPI schema。
 * @param {Record<string, any>} schemas - 全部 schema。
 * @returns {Map<string, string>} 字段 → 粗粒度类型。
 */
function readSchemaFields(schema, schemas) {
  const fields = new Map();
  const properties = schema?.properties ?? {};

  for (const [name, property] of Object.entries(properties)) {
    if (property?.$ref) {
      fields.set(name, property.$ref.split('/').at(-1));
      continue;
    }
    if (property?.type === 'array') {
      const itemRef = property.items?.$ref;
      fields.set(name, itemRef ? `${itemRef.split('/').at(-1)}[]` : 'array');
      continue;
    }
    if (property?.type === 'object' && property.properties) {
      schemas.set(`${name}__inline`, property);
      fields.set(name, 'object');
      continue;
    }

    fields.set(name, TYPE_MAP[property?.type] ?? 'unknown');
  }

  return fields;
}

/**
 * 把 `IShowcaseItemDTO` 这类接口名归一成 schema 名 `ShowcaseItem`。
 *
 * @param {string} name - 接口或 schema 名。
 * @returns {string} 归一后的名字。
 */
function canonicalName(name) {
  return name.replace(/^I/u, '').replace(/DTO$/u, '');
}

/**
 * 把接口字段类型归一成与 schema 可比的粗粒度类型。
 *
 * @param {string} type - DTO 字段类型片段。
 * @returns {string} 归一后的类型。
 */
function normalizeDtoType(type) {
  if (type.endsWith('[]')) {
    const element = type.slice(0, -2);
    return /^I[A-Z]\w*$/u.test(element) ? `${canonicalName(element)}[]` : 'array';
  }
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return type;
  }
  if (/^I[A-Z]\w*$/u.test(type)) {
    return canonicalName(type);
  }

  return type;
}

/**
 * 判断 schema 类型与 DTO 类型是否相容。
 *
 * @param {string} schemaType - schema 侧类型（基础类型、`Xxx[]` 或 `array`）。
 * @param {string} dtoType - DTO 侧归一后的类型。
 * @returns {boolean} 是否相容。
 */
function isCompatibleType(schemaType, dtoType) {
  if (schemaType === 'unknown' || schemaType === 'object') {
    return true;
  }
  if (schemaType === 'array') {
    return dtoType === 'array' || dtoType.endsWith('[]');
  }
  if (schemaType.endsWith('[]')) {
    return dtoType === schemaType;
  }

  return schemaType === dtoType;
}

/**
 * 比对单个 schema 与接口。
 *
 * @param {string} label - 报告用的路径。
 * @param {Record<string, any>} schema - schema。
 * @param {Map<string, string>} fields - schema 字段。
 * @param {Map<string, string>} dtoFields - 接口字段。
 * @param {string} interfaceName - 接口名。
 * @returns {void}
 */
function compare(label, schema, fields, dtoFields, interfaceName) {
  const required = new Set(schema?.required ?? []);
  const schemaNames = new Set(fields.keys());
  const dtoNames = new Set(dtoFields.keys());

  for (const name of schemaNames) {
    if (!dtoNames.has(name)) {
      fail(`${label}: schema 有字段 ${name}，${interfaceName} 缺失`);
    }
  }
  for (const name of dtoNames) {
    if (!schemaNames.has(name)) {
      fail(`${label}: ${interfaceName} 有字段 ${name}，schema 未声明`);
      continue;
    }

    const schemaType = fields.get(name);
    const dtoType = normalizeDtoType(dtoFields.get(name));
    if (required.has(name) && dtoType.endsWith('?')) {
      fail(`${label}: ${interfaceName}.${name} 在 schema 里是必填，DTO 却标成可选`);
    }
    // 引用类型按名字比对（IShowcaseItemDTO 对 ShowcaseItem）；基础类型只做粗粒度比对。
    if (!isCompatibleType(schemaType, dtoType)) {
      fail(`${label}: ${interfaceName}.${name} 类型不一致（schema=${schemaType}，dto=${dtoType}）`);
    }
  }
}

const contract = findContract();
if (!contract) {
  process.stdout.write('契约漂移检查跳过：没有找到 OpenAPI 契约（mock/openapi.yaml 或 mocks/openapi.yaml）\n');
  process.exit(0);
}

const document = parse(readFileSync(join(ROOT, contract), 'utf8'));
const schemas = document?.components?.schemas ?? {};
const interfaces = collectInterfaces();
let compared = 0;

for (const [schemaName, schema] of Object.entries(schemas)) {
  if (schema?.type !== 'object' || !schema.properties) {
    continue;
  }

  const aliasTarget = ALIASES[schemaName];
  const candidates = [aliasTarget, `I${schemaName}DTO`, `I${schemaName}`, `${schemaName}DTO`].filter(Boolean);
  const interfaceName = candidates.find((name) => interfaces.has(name));
  if (!interfaceName) {
    continue;
  }

  compared += 1;
  compare(
    `${contract}#${schemaName}`,
    schema,
    readSchemaFields(schema, schemas),
    interfaces.get(interfaceName),
    interfaceName,
  );
}

for (const [path, interfaceName] of Object.entries(ALIASES)) {
  const [schemaName, nested] = path.split('.');
  const schema = schemas[schemaName];
  const payload = nested ? schema?.properties?.[nested] : schema;
  const dtoFields = interfaces.get(interfaceName);
  if (!payload || !dtoFields) {
    continue;
  }

  compared += 1;
  compare(`${contract}#${path}`, payload, readSchemaFields(payload, schemas), dtoFields, interfaceName);
}

if (failures.length === 0) {
  process.stdout.write(`契约漂移检查通过：比对 ${compared} 个 schema/DTO 对\n`);
} else {
  process.stderr.write(`契约漂移检查失败（${failures.length} 项）：\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.exitCode = 1;
}
