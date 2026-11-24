/**
 * 指标状态的视觉语义。
 */
export type MetricTone = 'neutral' | 'success' | 'warning' | 'danger';

/**
 * 订单履约状态。
 */
export type OrderStatus = 'pending' | 'reviewing' | 'fulfilling' | 'completed';

/**
 * 订单筛选状态，all 仅用于前端查询条件。
 */
export type OrderStatusFilter = 'all' | OrderStatus;

/**
 * 单个顶部指标的业务含义、当前值与趋势说明。
 */
export interface IMetricItem {
  /**
   * 指标展示名称。
   */
  label: string;
  /**
   * 当前指标值，已按展示格式处理。
   */
  value: string;
  /**
   * 趋势说明或同比环比说明。
   */
  delta: string;
  /**
   * 指标对应的视觉语义。
   */
  tone: MetricTone;
}

/**
 * 履约流程阶段。
 */
export interface IWorkflowStage {
  /**
   * 阶段名称。
   */
  name: string;
  /**
   * 当前阶段中的业务对象数量。
   */
  count: number;
  /**
   * 阶段建议动作。
   */
  action: string;
}

/**
 * 订单队列中的单行数据。
 */
export interface IOrderQueueItem {
  /**
   * 订单唯一标识。
   */
  id: string;
  /**
   * 客户或账号标识。
   */
  customerName: string;
  /**
   * 商品或库存项名称。
   */
  productName: string;
  /**
   * 当前履约状态。
   */
  status: OrderStatus;
  /**
   * 负责人名称。
   */
  owner: string;
  /**
   * 下一步动作说明。
   */
  nextStep: string;
  /**
   * 最近更新时间展示值。
   */
  updatedAt: string;
}

/**
 * 状态筛选下拉选项。
 */
export interface IStatusOption {
  /**
   * 筛选值。
   */
  value: OrderStatusFilter;
  /**
   * 用户可见文案。
   */
  label: string;
}

/**
 * 看板首屏数据。
 */
export interface IWorkspaceDashboard {
  /**
   * 首屏指标列表。
   */
  metrics: IMetricItem[];
  /**
   * 履约流程阶段列表。
   */
  workflow: IWorkflowStage[];
  /**
   * 订单队列。
   */
  orders: IOrderQueueItem[];
}

/**
 * 订单队列查询条件。
 */
export interface IOrderQueueQuery {
  /**
   * 订单或客户关键词。
   */
  keyword: string;
  /**
   * 履约状态筛选。
   */
  status: OrderStatusFilter;
}
