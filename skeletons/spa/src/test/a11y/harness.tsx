/* eslint-disable react-refresh/only-export-components -- 夹具由独立 HTML 入口加载，不参与应用 HMR。 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers/app-providers';
import {
  AsyncState,
  Button,
  EmptyState,
  FieldRow,
  Input,
  PageHeader,
  Search,
  Select,
  StatCard,
  StatusPill,
} from '@/shared/ui';

import '@/styles.css';

/**
 * 共享 UI 原语的无障碍夹具。
 *
 * 只服务 axe：把每个 primitive 的常规态、禁用态、加载态和错误态一次性渲染出来，
 * 让真实浏览器能按布局计算对比度、命名与角色。不得被应用代码 import。
 *
 * @returns 夹具页面。
 */
function HarnessPage() {
  return (
    <main>
      <PageHeader
        title="共享组件无障碍基线"
        description="axe 在真实 Chromium 中检查这份夹具，覆盖共享原语的各个状态。"
        actions={<Button tone="primary">新建</Button>}
      />

      <section aria-labelledby="buttons-heading">
        <h2 id="buttons-heading">按钮</h2>
        <Button tone="primary">主要动作</Button>
        <Button>次要动作</Button>
        <Button tone="ghost">幽灵动作</Button>
        <Button tone="danger">危险动作</Button>
        <Button isPending pendingLabel="提交中">
          提交
        </Button>
        <Button disabled>已禁用</Button>
      </section>

      <section aria-labelledby="inputs-heading">
        <h2 id="inputs-heading">输入</h2>
        <div>
          <span>用户名</span>
          <Input aria-label="用户名" name="username-demo" autoComplete="username" placeholder="请输入用户名" />
        </div>
        <div>
          <span>密码</span>
          <Input.Password
            aria-label="密码"
            name="password-demo"
            autoComplete="current-password"
            placeholder="请输入密码"
          />
        </div>
        <div>
          <span>工作区</span>
          <Select
            aria-label="工作区"
            defaultValue="alpha"
            options={[
              { value: 'alpha', label: 'Alpha' },
              { value: 'beta', label: 'Beta' },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="fields-heading">
        <h2 id="fields-heading">字段行</h2>
        <div>
          <FieldRow label="租户" value="dealkeys" hint="只读信息，由服务端下发。" />
          <FieldRow label="环境" value="production" />
        </div>
      </section>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading">指标与状态</h2>
        <StatCard label="本月订单" value="1,280" delta="+8.2%" tone="success" />
        <StatCard label="失败任务" value="6" tone="danger" />
        <StatusPill tone="success">已完成</StatusPill>
        <StatusPill tone="warning">待确认</StatusPill>
        <StatusPill tone="danger">已失败</StatusPill>
      </section>

      <section aria-labelledby="empty-heading">
        <h2 id="empty-heading">空态</h2>
        <EmptyState
          icon={<Search aria-hidden="true" />}
          title="还没有数据"
          description="创建第一条记录后会显示在这里。"
          action={<Button tone="primary">新建记录</Button>}
        />
      </section>

      <section aria-labelledby="async-heading">
        <h2 id="async-heading">异步态</h2>
        <AsyncState loading>
          <p>加载完成后的内容</p>
        </AsyncState>
        <AsyncState loading={false} error errorNode={<p>加载失败，请重试。</p>} emptyNode={<p>暂无数据。</p>}>
          <p>加载完成后的内容</p>
        </AsyncState>
        <AsyncState loading={false} isEmpty emptyNode={<p>暂无数据。</p>}>
          <p>加载完成后的内容</p>
        </AsyncState>
        <AsyncState loading={false} errorNode={<p>加载失败，请重试。</p>} emptyNode={<p>暂无数据。</p>}>
          <p>加载完成后的内容</p>
        </AsyncState>
      </section>
    </main>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <HarnessPage />
    </AppProviders>
  </StrictMode>,
);
