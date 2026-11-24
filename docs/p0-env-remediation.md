# 批次 0：派生项目 env 与密钥处置

- 日期：2026-11-24
- 范围：`/Users/somnuszyy9527/workspace/dealkeys` 下 19 个带被跟踪 env 文件的仓库
- 性质：**人工执行**，不在骨架代码范围内。骨架门禁只能拦住新污染，不能清理已提交的内容
- 依据：`derived-projects-audit.md`（原前端骨架仓库）

## 1. 执行顺序

顺序不能颠倒：

1. **先轮换密钥**（§2）。文件已经从提交历史泄露，清理仓库不会让泄露过的值重新安全。
2. **再停止跟踪**（§3）。`git rm --cached` 只移除跟踪，不删本地文件，也不删历史。
3. **最后评估历史清理**（§4）。默认不清；只有确认远端曾对非授权方可见时才做。

轮换与停止跟踪之间不要有新的推送窗口，否则可能把旧值再推一次。

## 2. 必须轮换的密钥

| 仓库             | 文件                                            | 变量                                 | 说明                                                   |
| ---------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `wgcards-tv`     | `.env.dev`、`.env.test`                         | `PROVIDER_SECRET_ENCRYPTION_KEY`     | 服务端加密密钥，非 `VITE_*`，本不该出现在前端仓        |
| `wgcards-tv`     | `.env.test`                                     | `OSS_SECRET_KEY`                     | 对象存储密钥                                           |
| `wgcards-portal` | `.env.development`、`.env.product`、`.env.test` | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Next Server Action 加密密钥，泄露可伪造 action payload |

按占位符特征判别为疑似真实值（不含 `xxx` / `placeholder` / `change` 等标记）。轮换动作：

1. 在对应云厂商/服务端生成新值，写入部署环境变量或密钥管理，不写入仓库。
2. 用新值重启服务并验证功能。
3. 吊销旧值，确认旧值失效。
4. 在项目 ADR 或运维记录中登记轮换时间与影响范围，不记录密钥值本身。

## 3. 逐仓停止跟踪

仓库清单：

| 仓库                              | 被跟踪的 env                                               | `.gitignore` 现状 | 敏感键                                             |
| --------------------------------- | ---------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| `ToB-wholesalePlatform`           | `.env`、`.env.development`、`.env.production`、`.env.test` | 无 env 规则       | —                                                  |
| `api-transfer-web`                | `.env.development`、`.env.prod`、`.env.production`         | 无 env 规则       | —                                                  |
| `carrypin-b2c`                    | `.env`、`.env.local`、`.env.production`、`.env.test`       | 无 env 规则       | —                                                  |
| `panda-v3.0`                      | `.env.development`、`.env.production`、`.env.test`         | 无 env 规则       | —                                                  |
| `roushan-pf`                      | `.env.development`、`.env.production`、`.env.test`         | 无 env 规则       | —                                                  |
| `stock-front`                     | `.env.development`、`.env.production`、`.env.test`         | 无 env 规则       | —                                                  |
| `test-ai-gate`                    | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 6 条         | —                                                  |
| `uupaycard-web`                   | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 3 条         | —                                                  |
| `uupaycard-web-admin`             | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 3 条         | —                                                  |
| `uupaycard-web-exchange`          | `.env.prod`                                                | 已列 4 条         | —                                                  |
| `wgcards-admin-base`              | `.env`、`.env.production`、`.env.test`                     | 无 env 规则       | —                                                  |
| `wgcards-admin-core`              | `.env`、`.env.production`、`.env.test`                     | 无 env 规则       | —                                                  |
| `wgcards-admin-parent`            | `.env`、`.env.development`、`.env.production`、`.env.test` | 无 env 规则       | —                                                  |
| `wgcards-admin-wholesalePlatform` | `.env`、`.env.production`、`.env.test`                     | 无 env 规则       | —                                                  |
| `wgcards-portal`                  | `.env.development`、`.env.product`、`.env.test`            | 无 env 规则       | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`               |
| `wgcards-razer-web`               | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 3 条         | —                                                  |
| `wgcards-razer-web-admin`         | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 3 条         | —                                                  |
| `wgcards-razer-web-topup`         | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 3 条         | —                                                  |
| `wgcards-tv`                      | `.env.dev`、`.env.prod`、`.env.test`                       | 已列 2 条         | `OSS_SECRET_KEY`、`PROVIDER_SECRET_ENCRYPTION_KEY` |

执行（在 `dealkeys` 目录下逐条运行；`git rm --cached` 不会改动工作区文件）：

```bash
( cd ToB-wholesalePlatform && git rm --cached -- .env .env.development .env.production .env.test )
( cd api-transfer-web && git rm --cached -- .env.development .env.prod .env.production )
( cd carrypin-b2c && git rm --cached -- .env .env.local .env.production .env.test )
( cd panda-v3.0 && git rm --cached -- .env.development .env.production .env.test )
( cd roushan-pf && git rm --cached -- .env.development .env.production .env.test )
( cd stock-front && git rm --cached -- .env.development .env.production .env.test )
( cd test-ai-gate && git rm --cached -- .env.dev .env.prod .env.test )
( cd uupaycard-web && git rm --cached -- .env.dev .env.prod .env.test )
( cd uupaycard-web-admin && git rm --cached -- .env.dev .env.prod .env.test )
( cd uupaycard-web-exchange && git rm --cached -- .env.prod )
( cd wgcards-admin-base && git rm --cached -- .env .env.production .env.test )
( cd wgcards-admin-core && git rm --cached -- .env .env.production .env.test )
( cd wgcards-admin-parent && git rm --cached -- .env .env.development .env.production .env.test )
( cd wgcards-admin-wholesalePlatform && git rm --cached -- .env .env.production .env.test )
( cd wgcards-portal && git rm --cached -- .env.development .env.product .env.test )
( cd wgcards-razer-web && git rm --cached -- .env.dev .env.prod .env.test )
( cd wgcards-razer-web-admin && git rm --cached -- .env.dev .env.prod .env.test )
( cd wgcards-razer-web-topup && git rm --cached -- .env.dev .env.prod .env.test )
( cd wgcards-tv && git rm --cached -- .env.dev .env.prod .env.test )
```

然后给每个仓库补 `.gitignore` 通配段（19 个仓都要加，已列和未列的都要）：

```gitignore
# 环境配置：只提交模板；真实取值不入库
.env
.env.*
!.env.example
!.env.mock
!.env.*.example
```

提交信息建议统一为：

```text
chore: 停止跟踪本地 env 文件，改为模板 + env:init
```

## 4. 历史清理决策

默认**不清理**。判断标准：

- 远端只在公司内网 codeup，且历史访问范围可控 → 不清理，按 §2 轮换即可。
- 远端曾被外部人员、外包或公开镜像拉取过 → 清理历史并通知相关方。

清理方式（确认后再执行，需要所有协作者重新克隆）：

```bash
# 以 wgcards-tv 为例，先备份
git clone --mirror <remote> wgcards-tv-backup.git
pip install git-filter-repo
cd wgcards-tv && git filter-repo --invert-paths --path .env.dev --path .env.test
git push --force --all && git push --force --tags
```

清理后必须重新执行 §2 的轮换：历史里的值已经在拷贝、缓存和备份中存在。

## 5. 验证

停止跟踪后逐仓检查，输出应为 0：

```bash
printf '%-42s' 'ToB-wholesalePlatform:'; git -C ToB-wholesalePlatform ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'api-transfer-web:'; git -C api-transfer-web ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'carrypin-b2c:'; git -C carrypin-b2c ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'panda-v3.0:'; git -C panda-v3.0 ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'roushan-pf:'; git -C roushan-pf ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'stock-front:'; git -C stock-front ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'test-ai-gate:'; git -C test-ai-gate ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'uupaycard-web:'; git -C uupaycard-web ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'uupaycard-web-admin:'; git -C uupaycard-web-admin ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'uupaycard-web-exchange:'; git -C uupaycard-web-exchange ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-admin-base:'; git -C wgcards-admin-base ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-admin-core:'; git -C wgcards-admin-core ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-admin-parent:'; git -C wgcards-admin-parent ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-admin-wholesalePlatform:'; git -C wgcards-admin-wholesalePlatform ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-portal:'; git -C wgcards-portal ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-razer-web:'; git -C wgcards-razer-web ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-razer-web-admin:'; git -C wgcards-razer-web-admin ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-razer-web-topup:'; git -C wgcards-razer-web-topup ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
printf '%-42s' 'wgcards-tv:'; git -C wgcards-tv ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' | wc -l
```

整体复核：

```bash
# 任一仓库若仍返回 env 文件即未清理干净
for d in */; do [ -d "$d/.git" ] || continue; git -C "$d" ls-files | grep -E '(^|/)\.env' | grep -vE '\.(example|mock)$' && echo "  ↳ $d"; done
```

新项目侧的预防已经内置：`check-repo-hygiene --tracked` 会拦截已跟踪的 env 文件、白名单外变量、
`package-lock.json` 与 `pnpm-lock.yaml` 并存等情况，pre-commit 与 CI 双重调用。

## 6. 风险

| 风险                                       | 处理                                          |
| ------------------------------------------ | --------------------------------------------- |
| `git rm --cached` 后他人拉取时本地文件被删 | 提前通知；文件已在 `.gitignore`，本地副本保留 |
| 轮换期间服务中断                           | 选择低峰；新旧值并存窗口按厂商支持情况处理    |
| 清理历史打断分支与 PR                      | 只有确认必要才做；清理前完整备份 mirror       |
| 漏改 `.gitignore` 导致再次提交             | §3 的模板段统一追加；新仓已由骨架默认提供     |
