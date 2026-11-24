/**
 * 社交卡片图片的单一事实源。
 *
 * 两个消费者必须拿到同一组值,否则卡片里声明的图和 `opengraph-image.tsx` 实际产出的图会漂移:
 * - `src/app/opengraph-image.tsx`(文件约定,提供图片本体与 `size`/`contentType` 导出);
 * - `src/shared/seo/public-locale-metadata.ts` 的 `buildPublicOpenGraph()`(公开页显式引用该图)。
 *
 * `OG_IMAGE_PATH` 故意不带 Next 注入的内容哈希(`?<hash>`):该路由响应头是
 * `Cache-Control: public, max-age=0, must-revalidate`,裸地址不会被长缓存,图片内容变了立刻生效。
 */

/**
 * 图片本体所在的元数据路由路径,拼在站点 origin 之后即为绝对地址。
 */
export const OG_IMAGE_PATH = '/opengraph-image';

/**
 * Open Graph 推荐画布尺寸(1.91:1),公开页 metadata 与文件约定共用。
 */
export const OG_IMAGE_SIZE: { width: number; height: number } = { width: 1200, height: 630 };

/**
 * 社交图响应格式,与 `opengraph-image.tsx` 的 `contentType` 导出同源。
 */
export const OG_IMAGE_TYPE = 'image/png';

/**
 * 文件约定导出的兜底 alt。
 *
 * `alt` 在文件约定里是**静态导出**(Next 在构建期按命名导出读取),无法按请求语言切换,所以这里是
 * 语言无关的兜底值;公开页不复用它,而是由 `buildPublicOpenGraph()` 传入本地化站点名。
 */
export const OG_IMAGE_DEFAULT_ALT = 'SSR Application Skeleton';
