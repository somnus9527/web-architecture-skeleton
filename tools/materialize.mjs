#!/usr/bin/env node
/**
 * 把 rules/ 单源物化进每个 skeleton 的 docs/rules/。
 *
 * 规则：通用层（shared、frontend）的每份文档复制到各变体；若存在
 * rules/<variant>/<name>-variant.md，则追加到该文档末尾作为变体补段；
 * 变体专属文档（无对应的 -variant 后缀）落在 docs/rules/frontend/。
 * 复制与追加之后统一做 {{placeholder}} 替换，最后按实际文件生成索引。
 */

import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const COMMON_LAYERS = ['shared', 'frontend'];
const VARIANT_SOURCE_LAYER = 'frontend';

/**
 * 读取并解析 manifest。
 *
 * @param {string} variant - 变体名。
 * @returns {{ variant: string, ruleLayers: string[], substitutions: Record<string, string> }} manifest。
 */
function readManifest(variant) {
  const path = join(ROOT, 'manifests', `${variant}.json`);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));

  if (manifest.variant !== variant) {
    throw new Error(`${path} 的 variant 与目录名不一致。`);
  }

  return manifest;
}

/**
 * 递归列出一个目录下的 markdown 文件（相对路径）。
 *
 * @param {string} dir - 相对 ROOT 的目录。
 * @returns {string[]} 相对路径列表。
 */
function listMarkdown(dir) {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return listMarkdown(rel);
    }
    return entry.name.endsWith('.md') ? [rel] : [];
  });
}

/**
 * 应用占位替换。
 *
 * @param {string} text - 原始文本。
 * @param {Record<string, string>} substitutions - 占位与取值。
 * @returns {string} 替换后的文本。
 */
function substitute(text, substitutions) {
  return text.replace(/\{\{(\w+)\}\}/gu, (match, key) => {
    if (!(key in substitutions)) {
      throw new Error(`未声明的占位 ${match}，请在 manifest 的 substitutions 中补充。`);
    }
    return substitutions[key];
  });
}

/**
 * 生成一个目录的索引 markdown。
 *
 * @param {string} heading - 一级标题。
 * @param {Array<{ file: string, title: string }>} entries - 索引条目。
 * @returns {string} 索引内容。
 */
function renderIndex(heading, entries, prefix = '') {
  const rows = entries
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((entry) => {
      const name = entry.file.slice(entry.file.lastIndexOf('/') + 1);
      return `| [${name}](./${prefix}${entry.file}) | ${entry.title} |`;
    })
    .join('\n');

  return `# ${heading}\n\n| 文件 | 主题 |\n| --- | --- |\n${rows}\n`;
}

/**
 * 物化一个变体。
 *
 * @param {string} variant - 变体名。
 * @returns {{ written: number, removed: number }} 统计。
 */
function materialize(variant) {
  const manifest = readManifest(variant);
  const outRoot = join(ROOT, 'skeletons', variant, 'docs', 'rules');

  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  const entries = [];
  let written = 0;

  const writeDoc = (layer, name, body) => {
    const target = join(outRoot, layer, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, substitute(body, manifest.substitutions));
    entries.push({
      layer,
      file: `${layer}/${name}`,
      title: readTitleRelative(layer, name, outRoot),
    });
    written += 1;
  };

  const readTitleRelative = (layer, name, root) => {
    const line = readFileSync(join(root, layer, name), 'utf8')
      .split('\n')
      .find((candidate) => candidate.startsWith('# '));
    return line ? line.slice(2).trim() : name;
  };

  for (const layer of COMMON_LAYERS) {
    for (const rel of listMarkdown(`rules/${layer}`)) {
      const name = rel.slice(`rules/${layer}/`.length);
      const body = readFileSync(join(ROOT, rel), 'utf8');
      const variantFile = `rules/${variant}/${name.replace(/\.md$/u, '-variant.md')}`;
      const appended = existsSync(join(ROOT, variantFile))
        ? `\n${readFileSync(join(ROOT, variantFile), 'utf8').trim()}\n`
        : '';
      writeDoc(layer, name, `${body.trimEnd()}\n${appended}`);
    }
  }

  for (const rel of listMarkdown(`rules/${variant}`)) {
    const name = rel.slice(`rules/${variant}/`.length);
    if (name.endsWith('-variant.md')) {
      continue;
    }
    const body = readFileSync(join(ROOT, rel), 'utf8');
    writeDoc(VARIANT_SOURCE_LAYER, name, body);
  }

  const frontendEntries = entries.filter((entry) => entry.layer === 'frontend');
  writeFileSync(
    join(outRoot, 'README.md'),
    renderIndex('Rules', [...entries.filter((entry) => entry.layer === 'shared'), ...frontendEntries], ''),
  );
  writeFileSync(
    join(outRoot, 'frontend', 'README.md'),
    renderIndex(
      'Frontend Rules',
      frontendEntries
        .filter((entry) => entry.file !== 'frontend/README.md')
        .map((entry) => ({
          ...entry,
          file: entry.file.replace(/^frontend\//u, ''),
        })),
    ),
  );

  const sharedHooks = join(ROOT, 'shared-assets', 'src', 'shared', 'hooks');
  const hookTarget = join(ROOT, 'skeletons', variant, 'src', 'shared', 'hooks');
  mkdirSync(hookTarget, { recursive: true });
  for (const name of readdirSync(sharedHooks)) {
    cpSync(join(sharedHooks, name), join(hookTarget, name));
  }

  const sharedHookTests = join(ROOT, 'shared-assets', 'src', 'test', 'shared');
  const hookTestTarget = join(ROOT, 'skeletons', variant, 'src', 'test', 'shared');
  mkdirSync(hookTestTarget, { recursive: true });
  for (const name of readdirSync(sharedHookTests)) {
    cpSync(join(sharedHookTests, name), join(hookTestTarget, name));
  }

  const projectScripts = join(ROOT, 'tools', 'project', 'scripts');
  const scriptTarget = join(ROOT, 'skeletons', variant, 'scripts');
  mkdirSync(scriptTarget, { recursive: true });
  for (const name of readdirSync(projectScripts)) {
    cpSync(join(projectScripts, name), join(scriptTarget, name));
  }
  cpSync(join(ROOT, 'tools', 'project', 'repo-hygiene.json'), join(ROOT, 'skeletons', variant, '.repo-hygiene.json'));

  const skillTarget = join(ROOT, 'skeletons', variant, '.agents', 'skills');
  rmSync(skillTarget, { recursive: true, force: true });
  mkdirSync(skillTarget, { recursive: true });

  for (const skill of manifest.skills ?? []) {
    const source = join(ROOT, 'skills', skill);
    if (!existsSync(source)) {
      throw new Error(`skills/${skill} 不存在，但 manifest 声明了它。`);
    }
    cpSync(source, join(skillTarget, skill), { recursive: true });
  }

  return { written, removed: 0 };
}

const variants = readdirSync(join(ROOT, 'manifests'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/u, ''));

for (const variant of variants) {
  const { written } = materialize(variant);
  process.stdout.write(`${variant}: 生成 ${written} 份规则\n`);
}
