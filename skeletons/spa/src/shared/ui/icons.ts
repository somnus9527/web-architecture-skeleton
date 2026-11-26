/**
 * 共用图标出口。业务优先从这里取 antd 图标，避免每个 feature 直接依赖
 * `@ant-design/icons`；antd 没有对应图标时，允许 feature 直接引用专用图标包。
 */
export {
  DollarOutlined,
  InboxOutlined,
  LineChartOutlined,
  LockOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
