import { HomeScreen } from '@components/home/home-screen';

/**
 * 首页路由：只把路由参数透传给 screen。
 *
 * @returns 页面节点。
 */
export default function IndexRoute() {
  return <HomeScreen />;
}
