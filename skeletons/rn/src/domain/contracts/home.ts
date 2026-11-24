/**
 * 工作台摘要条目。
 */
export interface IHomeSummaryItem {
  /**
   * 条目 id。
   */
  id: string;
  /**
   * 条目标题。
   */
  title: string;
  /**
   * 条目状态。
   */
  status: 'pending' | 'active' | 'done';
}

/**
 * 工作台摘要响应。
 */
export interface IHomeSummary {
  /**
   * 摘要标题。
   */
  title: string;
  /**
   * 摘要条目。
   */
  items: IHomeSummaryItem[];
}
