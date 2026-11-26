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
const DEFAULT_VARIANT_TARGET_LAYER = 'frontend';

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
function substitute(text, substitutions, allowUnknown = false) {
  return text.replace(/\{\{(\w+)\}\}/gu, (match, key) => {
    if (key in substitutions) {
      return substitutions[key];
    }
    if (allowUnknown) {
      // 文档自身的占位（如 {{latestVersion}}）需要原样保留给读者。
      return match;
    }
    throw new Error(`未声明的占位 ${match}，请在 manifest 的 substitutions 中补充。`);
  });
}

/**
 * 生成一个目录的索引 markdown。
 *
 * @param {string} heading - 一级标题。
 * @param {Array<{ file: string, title: string }>} entries - 索引条目。
 * @returns {string} 索引内容。
 */
function renderIndex(heading, entries, prefix = '', options = {}) {
  const { intro = '', mustRead } = options;
  const toRow = (entry) => {
    const name = entry.file.slice(entry.file.lastIndexOf('/') + 1);
    return `| [${name}](./${prefix}${entry.file}) | ${entry.title} |`;
  };
  const sorted = [...entries].sort((a, b) => a.file.localeCompare(b.file));
  const mustReadSet = new Set(mustRead ?? []);
  const primary = sorted.filter((entry) => mustReadSet.has(entry.file));
  const rest = sorted.filter((entry) => !mustReadSet.has(entry.file));
  const table = (rows) => `| 文件 | 主题 |\n| --- | --- |\n${rows.map(toRow).join('\n')}`;
  const sections = [];

  if (intro) {
    sections.push(intro);
  }
  if (primary.length > 0) {
    sections.push(`## 必读\n\n${table(primary)}`);
  }
  if (rest.length > 0) {
    sections.push(`## 其余规则\n\n${table(rest)}`);
  }

  return `# ${heading}\n\n${sections.join('\n\n')}\n`;
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
    writeFileSync(target, substitute(body, manifest.substitutions, manifest.allowUnknownPlaceholders === true));
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

  const commonLayers = (manifest.ruleLayers ?? COMMON_LAYERS).filter((layer) => layer !== variant);

  for (const layer of commonLayers) {
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

  const variantTarget = manifest.variantLayerTarget ?? DEFAULT_VARIANT_TARGET_LAYER;
  for (const rel of listMarkdown(`rules/${variant}`)) {
    const name = rel.slice(`rules/${variant}/`.length);
    if (name.endsWith('-variant.md')) {
      continue;
    }
    const body = readFileSync(join(ROOT, rel), 'utf8');
    writeDoc(variantTarget, name, body);
  }

  // 显式追加规则：用于只消费某一层的少数文档（如 monorepo 只要 monorepo-workspace.md）。
  for (const rel of manifest.ruleInclude ?? []) {
    const separator = rel.indexOf('/');
    if (separator <= 0 || separator === rel.length - 1) {
      throw new Error(`manifest.ruleInclude 路径不合法: ${rel}`);
    }
    const layer = rel.slice(0, separator);
    const name = rel.slice(separator + 1);
    if (entries.some((entry) => entry.file === `${layer}/${name}`)) {
      continue;
    }
    writeDoc(layer, name, readFileSync(join(ROOT, 'rules', rel), 'utf8'));
  }

  const frontendEntries = entries.filter((entry) => entry.layer === 'frontend');
  const mustRead = manifest.mustRead ?? [];
  const intro = '本目录由 `rules/` 物化生成，不要手改：先读必读，再按任务检索。';

  writeFileSync(
    join(outRoot, 'README.md'),
    renderIndex('Rules', [...entries], '', {
      intro,
      mustRead,
    }),
  );
  if (frontendEntries.length > 0) {
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
        '',
        {
          intro: '前端规则分两档：必读用于任何前端改动，其余按任务检索。',
          mustRead: mustRead
            .filter((path) => path.startsWith('frontend/'))
            .map((path) => path.replace(/^frontend\//u, '')),
        },
      ),
    );
  }

  const sharedAssets = manifest.sharedAssets ?? {};

  const sharedHooks = join(ROOT, 'shared-assets', 'src', 'shared', 'hooks');
  const hookTarget = join(ROOT, 'skeletons', variant, 'src', 'shared', 'hooks');
  if (sharedAssets.hooks !== false) {
    mkdirSync(hookTarget, { recursive: true });
    for (const name of readdirSync(sharedHooks)) {
      cpSync(join(sharedHooks, name), join(hookTarget, name));
    }
  }

  const sharedDocs = join(ROOT, 'shared-assets', 'docs');
  if (existsSync(sharedDocs)) {
    for (const entry of readdirSync(sharedDocs, { withFileTypes: true })) {
      // 部署手册只适用于 Web 变体；RN/monorepo 不生成无意义的 docs/deployment 副本。
      if (entry.name === 'deployment' && variant !== 'spa' && variant !== 'ssr') {
        continue;
      }
      cpSync(join(sharedDocs, entry.name), join(ROOT, 'skeletons', variant, 'docs', entry.name), { recursive: true });
    }
  }

  if (sharedAssets.components !== false) {
    const sharedComponents = join(ROOT, 'shared-assets', 'src', 'shared', 'components');
    cpSync(sharedComponents, join(ROOT, 'skeletons', variant, 'src', 'shared', 'components'), { recursive: true });
  }

  const sharedSecurity = join(ROOT, 'shared-assets', 'src', 'shared', 'security');
  if (existsSync(sharedSecurity) && sharedAssets.security !== false) {
    cpSync(sharedSecurity, join(ROOT, 'skeletons', variant, 'src', 'shared', 'security'), { recursive: true });
  }

  if (sharedAssets.architectureTests !== false) {
    const sharedArchTests = join(ROOT, 'shared-assets', 'src', 'test', 'architecture');
    const archTestTarget = join(ROOT, 'skeletons', variant, 'src', 'test', 'architecture');
    mkdirSync(archTestTarget, { recursive: true });
    cpSync(sharedArchTests, archTestTarget, { recursive: true });
  }

  if (sharedAssets.hookTests !== false) {
    const sharedHookTests = join(ROOT, 'shared-assets', 'src', 'test', 'shared');
    const hookTestTarget = join(ROOT, 'skeletons', variant, 'src', 'test', 'shared');
    mkdirSync(hookTestTarget, { recursive: true });
    for (const name of readdirSync(sharedHookTests)) {
      cpSync(join(sharedHookTests, name), join(hookTestTarget, name));
    }
  }

  const projectScripts = join(ROOT, 'tools', 'project', 'scripts');
  const scriptTarget = join(ROOT, 'skeletons', variant, 'scripts');
  const allowedScripts = manifest.projectScripts ?? readdirSync(projectScripts);
  mkdirSync(scriptTarget, { recursive: true });
  for (const name of allowedScripts) {
    cpSync(join(projectScripts, name), join(scriptTarget, name));
  }
  if (manifest.hygiene !== false) {
    cpSync(join(ROOT, 'tools', 'project', 'repo-hygiene.json'), join(ROOT, 'skeletons', variant, '.repo-hygiene.json'));
  }

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
