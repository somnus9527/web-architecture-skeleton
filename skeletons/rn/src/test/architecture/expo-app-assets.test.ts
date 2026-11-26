import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** PNG 文件头，用于排除「路径写了但文件不是图片」的假配置。 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** iOS 商店图标要求 1024×1024。 */
const ICON_MIN_SIZE = 1024;

/** Android adaptive icon 前景图最低 512×512（规则里的商店基线）。 */
const ADAPTIVE_ICON_MIN_SIZE = 512;

/** `app.json` 里所有 `./assets/...` 引用。 */
const ASSET_REFERENCE = /"\.\/assets\/[^"]+"/gu;

interface IAppAssetsConfig {
  /** Expo 应用配置。 */
  expo: {
    icon?: string;
    splash?: { image?: string };
    android?: { adaptiveIcon?: { foregroundImage?: string; backgroundColor?: string } };
  };
}

const appJson = readFileSync(join(process.cwd(), 'app.json'), 'utf8');
const appConfig = JSON.parse(appJson) as IAppAssetsConfig;

/**
 * 读取 PNG 尺寸。
 *
 * @param relativePath - 相对仓库根的图片路径。
 * @returns 宽高。
 */
function readPngSize(relativePath: string): { width: number; height: number } {
  const buffer = readFileSync(join(process.cwd(), relativePath));

  expect(buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * 找出 `app.json` 引用到的全部本地资源路径。
 *
 * @returns 去掉引号的相对路径列表。
 */
function listAssetReferences(): string[] {
  return [...appJson.matchAll(ASSET_REFERENCE)].map((match) => match[0].replace(/"/gu, ''));
}

describe('rn expo app assets', () => {
  it('should resolve every local asset referenced by app.json', () => {
    const missing = listAssetReferences().filter((path) => !existsSync(join(process.cwd(), path)));

    expect(missing).toEqual([]);
  });

  it('should ship a store-ready app icon', () => {
    const icon = appConfig.expo.icon;

    expect(icon).toBeDefined();
    expect(existsSync(join(process.cwd(), icon ?? ''))).toBe(true);

    const { width, height } = readPngSize(icon ?? '');

    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(ICON_MIN_SIZE);
  });

  it('should ship an adaptive icon foreground for Android', () => {
    const foregroundImage = appConfig.expo.android?.adaptiveIcon?.foregroundImage;

    expect(appConfig.expo.android?.adaptiveIcon).toBeDefined();
    expect(foregroundImage).toBeDefined();

    const { width, height } = readPngSize(foregroundImage ?? '');

    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(ADAPTIVE_ICON_MIN_SIZE);
  });

  it('should use a hex background color for the adaptive icon', () => {
    const backgroundColor = appConfig.expo.android?.adaptiveIcon?.backgroundColor;

    expect(backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/u);
  });
});
