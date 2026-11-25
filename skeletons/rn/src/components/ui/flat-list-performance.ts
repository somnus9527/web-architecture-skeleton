/**
 * 低端机长列表性能常量。
 *
 * 业务长列表（FlatList / SectionList）必须复用这些常量，而不是各写一份魔数。
 */

/** 首屏渲染条目数。 */
export const LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT = 6;

/** 每批次最多渲染条目数。 */
export const LOW_END_FLAT_LIST_MAX_BATCH_COUNT = 6;

/** 批次间隔，单位毫秒。 */
export const LOW_END_FLAT_LIST_BATCHING_PERIOD_MS = 64;

/** FlatList 渲染窗口大小，单位为屏。 */
export const LOW_END_FLAT_LIST_WINDOW_SIZE = 7;
