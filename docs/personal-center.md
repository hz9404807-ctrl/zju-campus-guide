# 个人中心交付说明

本轮从 `origin/main` 的 `0dae201` 创建 `feat/personal-center`，通过 PR 交接，不合并 main，不发布网站。真实邮箱注册与联调按用户后续要求暂缓。

## 页面与行为

- `/account`：账号概览、仅本人可见的登录邮箱、我的发布、我的评分、退出登录。桌面主导航与手机顶部均有入口。
- `/food/mine` 继续可用，与个人中心复用 `OwnedFoodList` 及原有编辑、撤下、恢复接口；撤下恢复后同步刷新个人评分。
- `/food/login?returnTo=...` 可返回 `/account`，保留查询与锚点；原 `/food` 返回地址与验证码续接不变，仍拒绝外部返回地址。
- 账号检查、个人发布和个人评分分别提供加载、失败及重试状态；空记录与接口尚未接入明确区分。未验证账号不挂载个人内容。
- 账号事件立即使旧身份请求失效；同一已验证账号的令牌刷新或重复登录只后台复核，保留未保存文字与本地图片，实际换号、退出或复核失败才清空。个人列表和发布/编辑表单按账号重建，退出后卸载，旧请求、未保存字段与本地图片预览不带入其他账号。
- 校园办事、信息源、美食浏览保持公开；不添加昵称/头像编辑、账号注销或另一套身份存储。

## 服务与增量迁移

沿用 `FoodAccountProvider`、`useFoodAuth`、`foodService`、`foodApi` 和唯一 Supabase 客户端。`myFoods` 在查询前后核对服务端身份；新增 `myRatings()` 调用无参数 `list_my_food_ratings()`，不接受任意用户 ID。

需要新增迁移：`supabase/migrations/202610170001_personal_center_ratings.sql`。它只增加个人评分历史 RPC：使用既有 `require_campus_member()` 核对真实 Auth 记录，再按 `auth.uid()` 返回本人评分。撤下菜品保留本人的评分与时间，名称、地点、图片均返回 NULL，不提供失效详情入口。只有 authenticated 具有执行权限，固定空 search_path。

该迁移依赖已部署的 `202610130001_food_email_management.sql`，不依赖五档案迁移。本轮**没有执行任何云端迁移**。部署前个人评分会显示“尚待共享服务接入”，不会显示假空数据；组长审阅并另行授权部署后，才能验收真实个人评分。

既有 raw `ratings` 的公开读取策略与评分资格规则保持原样；新 RPC 隔离的是当前账号的历史查询，不能宣称旧评分表因此全面私有。浏览器不查询 `auth.users`。未修改 SMTP、邮箱绑定、功能开关或任何旧迁移。

## 本机启动与检查

使用 Node.js 24。在项目根目录运行：

```powershell
npm ci
npm test
npm run test:db
npm run typecheck
npm run build
npm run dev
```

默认开发地址 `http://127.0.0.1:5173/account`。无 `.env.local` 时只能检查未登录与只读浏览。真实联调仅需自己的浙大邮箱、项目 URL、publishable key 与现有功能开关；配置放被忽略的 `.env.local`，不向组长索要个人邮箱密码、验证码或管理密钥。

## 可复现的隔离浏览器检查

`tests/browser/personal-center.js` 是可审阅的 Playwright CLI 回归脚本，不自动加入 Node 单元测试；不增加项目依赖。已安装 Playwright CLI 的开发者可在单独终端启动以下本机测试进程：

```powershell
$env:VITE_SUPABASE_URL='https://personal-center-test.invalid'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_personal_center_browser_fixture'
$env:VITE_FOOD_EMAIL_AUTH_READY='true'
$env:VITE_FOOD_PROFILES_READY='false'
npm run dev -- --port 5176
```

另一个终端执行：

```powershell
playwright-cli -s=personal-center open about:blank
playwright-cli -s=personal-center --raw run-code --filename=tests/browser/personal-center.js
playwright-cli -s=personal-center close
```

这些变量仅属于隔离测试进程，不保存为真实环境配置，不调整云端开关。脚本拦截测试域名的全部服务请求，生成两个明确的测试身份和响应，检查实际前端与 Supabase SDK 的衔接；不创建真实账户、不发送邮件、不写云端。Node 测试验证 API/Hook 竞态，PGlite 测试独立验证 SQL 权限；这些证据不等于真实 Supabase 联调。

截图输出到被忽略的 `scratch/personal-center-desktop.png` 和 `scratch/personal-center-mobile.png`，仅显示浏览器测试数据。截图、会话、环境配置、构建产物和工具缓存不进入 Git。

## 本轮验证与待验收

- `npm ci` 完成，未新增依赖或修改锁文件。
- Node 测试 325 项通过；类型检查和生产构建通过。构建仍提示单个 JS 分块超过 500 kB。
- 本地数据库 127 次断言通过：基础 33、邮箱 23、档案兼容 29、个人中心 21 × 两种结构；事务回滚后没有测试数据残留，不连接真实 Supabase。
- 隔离浏览器 31 项检查通过，覆盖未登录、验证码返回地址、账号概览、A/B 隔离、刷新、撤下恢复、评分详情、慢响应、错误重试、未部署接口，以及 1440/1024/901/780/390/320 px 布局。截图逐张检查。
- 尚未验收：用户自己的真实浙大邮箱登录与个人数据、增量 RPC 云端部署后的真实权限、实际手机/其他浏览器和跨设备一致性。用户要求先暂缓真实注册联调，不能以测试夹具替代。
