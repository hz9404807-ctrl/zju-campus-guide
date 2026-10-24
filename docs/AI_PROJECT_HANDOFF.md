## 问卷反馈交接（2026-10-24，魔搭已发布、main待审）

本轮 `codex/user-test-feedback` / [PR #8](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/8)从最新main创建工作区，再快进接入PR #7的 `dd7e58d`。PR以 `codex/saturday-polish`为基线，只显示本轮增量；建议组长先审核PR #8合到该功能分支，再审核更新后的PR #7整体合main，避免先部署旧中间版。合并前重新获取远程、检查差异；没有由AI合并main或覆盖其他工作区，PR #3独立保留。

已通过[运行40086456065](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/40086456065)发布原魔搭，运行来源 `d3287a042cc15a05b854e6cc99a2e9b0baa0428c` / connected / Running。`GuideExternalLink`复用既有service/reference/windows语义，通用学校服务标“官方入口”，不把电话表或教师检索称作办理；`GuideContents`手机固定在页头下，使用location.key处理同锚点重复定位；`guideTaskSummary`仅按当前路线统计，不混合材料。`GuideServiceWindows.context`保留财务适用范围原文。

`GuideProvenance`展示收集与资料核对日期/范围，`guideFeedback.ts`只接受数据内指南/路线构造固定项目GitHub新建Issue草稿。用户自行确认提交，需GitHub登录且内容公开；复制失败有原文，不携带搜索、returnTo或宿主参数，不自动提交。本轮不重建组长计划中的准备清单/纠错后台；后续用真实接口替换反馈入口即可，不保留双写流程。

无新依赖/迁移/云端配置，不改账号、SMTP、五档案或评分规则。420项Node、类型检查、构建和本机130/58/54项界面检查通过；发布流程另跑235项PGlite断言；生产16项HTTP和87项访客浏览器检查通过。一次性发布流程已删除，永久main流程不变，交接提交不改变运行构建。宿主异常/宽视口、截图及原资料迁移未接入等边界见开发记录。原Sites和共享业务数据不变。

## 上一轮更新交接（2026-10-23，魔搭已发布、main待审）

用户在开发交付后明确要求立即更新GitHub和魔搭。分支 `codex/saturday-polish`、[整合PR #7](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/7)已通过 [发布运行](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/39944450516) 更新同一个魔搭站点；公开运行来源为 `661e561ea677f626a4ec197d722809826dfc69a4`、connected，空间Running。远程main仍 `25f2e69`、未直接合并；PR #7包含PR #6前置代码，组长优先审阅PR #7，避免重复应用旧PR。后续文档和临时工作流清理不改变运行构建；合并前再核对协作更新。PR #3仍独立，保留其收藏/搜索/拆包能力；原Sites与共享业务数据未改。

个人中心子页 `/account/posts`、`/account/ratings` 各6条显示分页，旧 `/food/mine` 继续兼容。现有本人服务读取与RLS不变；账号切换按ID重建，评分撤下条目不读图。`personalRecords.ts`限定三个个人路径及安全page，详情、编辑、发布和登录续接均保留合法返回页。新建真实成功后原页显示继续发布操作，第二份草稿清空旧图/评分；编辑成功仍返回详情。

同一PR后续打磨：个人子页合并顶部导航并精简重复账号链接，保留验证状态/退出/错误；共享 `ResultPager` 增加最多5槽的数字页码与首尾直达，手机44px及标题焦点不变。发布校验等待错误渲染后聚焦，损坏预览提示/拦截/换图恢复，移除后回到选图。美食空价格明确显示“价格待补充”，0元和长文本分别处理。最新399项Node、类型检查与构建通过，本机界面各组49/53/86/93/37项；发布Actions另重跑依赖安装、同组测试、PGlite和构建均通过。范围和截图见开发记录，没有新迁移或云端数据库操作。

首页采用用户原文“办事有方法，信息有方向，生活有去处”，`CampusEmblem`为简洁对称SVG，原Logo和原插画文件保留。补充既有10份官方指南，目录121网站；证据、读取失败和年度范围见内容核验文档。旧WebView兼容改在 `timeoutFetch.ts`，保留12秒请求及响应体截止，不另建客户端或登录态。

周六测试结束后才由组长执行 `supabase/maintenance/withdraw-acceptance-foods.sql`：默认ROLLBACK、锁定四条精确指纹、保留评分/图片、创建私有回退审计表；这是可恢复撤下而非永久删除，未在云端执行。功能本身无新增迁移；上一轮个人资料的 `202610220001_campus_account_details.sql`仍待接入。验证数字、截图及不能替代的实机/云端验收见最新开发记录。

## 魔搭共享部署接入（2026-10-21）

本轮发布整合：用户另行明确要求更新GitHub与同一魔搭站点，`fix/mobile-release`已整合PR #4/#5并精简页面小字、加大手机入口及补充外链复制。main仍待组长审核；本次精确分支Actions运行39904983944成功，公网版本已核对为 `5db6f58e15a9edb9bf3deb0efb9d945acf25926f`、connected，云端启动与复测见 development-status.md 最上方。验收后已删除一次性工作流，永久main流程保留。本分支需要组长审阅PR #6，避免重复应用旧PR代码；PR #3仍独立。

与PR #3的最新试算有9处文本冲突（不执行实际合并）：除第11节原五个文件外，另有 `SourcePages.tsx` 与三份记录 `README.md`、`docs/AI_PROJECT_HANDOFF.md`、`docs/development-status.md`。整合时来源页同时保留收藏按钮和本轮“资料说明”披露；文档保留各轮证据并由最新实际状态领头。不要把本轮单分支验证数字当成组合版结果。

### 首次接入历史（2026-10-21）

用户要求部署到魔搭并共同查看合并后的版本。`codex/modelscope-deploy` 从 main 25f2e69 建立独立工作目录；PR #4 为部署配置，PR #3 为此前功能，当时两者均未合并。首次将 main 应用手动发布到 zzzhr777/zju-campus-guide，免费 Docker 为 Running。全屏网址：https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide?mode=full 。操作见 [魔搭部署](modelscope-deployment.md)。

本人登录后明确授权使用现有魔搭部署令牌并保存 GitHub Actions Secret。六项接入设置已完成，MODELSCOPE_DEPLOY_ENABLED=true；当时尚未执行Actions，计划PR #4合入main后触发。初始 bootstrap 确认变量已移除，后续凭镜像标记保留历史。公开配置只在忽略文件和 GitHub Variables；邮箱true、五档案false，原 Sites 和数据库配置维持原状。

首次电脑端验证了主要公开流程与访客登录入口。当时390px窄窗口检查出现1280px容器，因此只作为电脑共享预览；本轮手机触摸UA已按视口适配，具体点击问题见 development-status.md 顶部最新记录。iframe内导航后外层刷新仍回到入口app_path，分享使用干净地址，勿记录iframe临时参数。真实浙大邮箱发码、换号与物理手机待验收。

## 当前协作状态（2026-10-19）

个人中心代码已由组长合并，原 Supabase 已部署评分历史 RPC 与邮箱发布/评分限制。一个邮箱一个 Auth 账号，五档案关闭；账号注销未实现。后续 AI 请从最新 main 开始，勿重复执行已部署迁移或重新配置 SMTP。当前部署版本与验收边界见 `docs/development-status.md` 最上方记录，下方较早的交接任务作为历史背景。

# 浙大校园指南：给协作 AI 的项目速览

> 目的：把本文作为新成员或其 AI 的首份项目上下文。它说明工程是什么、从哪里访问、哪些文件负责什么，以及安全的修改与验证方式。用户最新指令优先；需求文档决定产品规则，代码与 Git 状态反映当前实现。三者不一致时，先报告差异，不自行选择其一。

## 1. 项目与当前状态

- **项目名称**：浙大校园指南（《人类工效学》课程原型，**不是**浙江大学官方平台）。
- **本地工程目录**：`D:\个人关键文件夹转移\Codex\zju-campus-guide`
- **源码仓库**：<https://github.com/hz9404807-ctrl/zju-campus-guide>
- **协作基线**：2026-10-15已核对远程main包含 `166796d`（本机服务恢复与验证码续接）。组长工作分支为 `feat/food-email-profiles`；协作者应从最新origin/main开始，个人中心工作放独立功能分支。开始前必须运行 `git branch --show-current` 和 `git status --short`，以实际结果为准，并保留其他人的未提交改动。
- **公开站点**：<https://zju-campus-guide.sangnuo0808.chatgpt.site>。已于2026-10-15发布Sites第4版，功能基线为GitHub a3732fc（Sites源码提交5a7e1553e6b66aca53a9c01f4abf5966a0d6f6c8）。后续个人中心分支的改动不在该版本中；线上版本不能代替新分支的验收。GitHub源码同步已按AGENTS.md授权；协作者建议推送自己的功能分支并通过PR交接，避免直接合并main。托管网站发布和云端迁移仍需单独授权。
- **当前内容规模**（见 `src/data/content-manifest.json`）：98 份办事指南、101 个网站入口、48 个公众号、31 个服务点。

## 2. 快速访问与运行

### 面向使用者

首页提供三个产品模块，另有一个说明页：

1. `/guides`：校园办事指南，可搜索、筛选和阅读详情；详情形如 `/guides/campus-card-replacement`。
2. `/food`：校园内外美食浏览、搜索、筛选、查看详情；`/food/new` 为发布页。
3. `/sources`：校园网站和公众号导航；详情形如 `/sources/<sourceId>`。
4. `/about`：项目边界与资料来源说明。

### 面向开发者

工程要求 Node.js `>=24 <25`。在工程根目录执行：

```powershell
npm ci
npm test
npm run test:db
npm run typecheck
npm run build
npm run dev
```

- `npm run dev` 固定监听 `http://127.0.0.1:5173`；仅本机可访问。
- 构建后运行 `node tools/start-local.mjs`，或Windows双击 `tools/start-local.cmd`：固定127.0.0.1:4175，独立后台进程运行。组长电脑的127.0.0.1不是公共网址，同学需要在自己电脑启动。
- `npm test` 是 Node 单元/回归测试；`npm run test:db` 使用内存 PGlite 模拟数据库，不会访问真实 Supabase。
- 在 PowerShell 遇到执行策略阻止时，使用 `npm.cmd` 替代 `npm`。

## 3. 技术构成

| 层级 | 技术/位置 | 责任 |
| --- | --- | --- |
| 前端 | React 19 + TypeScript + Vite 8 | 单页应用、界面与构建 |
| 路由 | `react-router`，入口 `src/main.tsx`，集中路由 `src/App.tsx` | URL、页面切换、标题、主导航与无障碍焦点 |
| 页面 | `src/pages/` | 办事指南、信息源、美食列表/详情/发布页 |
| 可复用组件 | `src/components/` | 搜索、评分、分页、窗口信息、指南步骤等 |
| 静态内容 | `src/data/` | 指南、服务点、公众号、网站与内容清单 |
| 美食服务 | `src/lib/foodService.ts`、`src/lib/foodApi.ts`、`src/hooks/useFoodResource.ts` | 示例模式、匿名身份、查询、上传、发布与评分 |
| 后端定义 | `supabase/migrations/` | PostgreSQL、RLS、Storage、发布 RPC 与评分约束 |
| 测试 | `tests/`、`supabase/test-runtime/` | 前端纯逻辑/API 契约与本地数据库迁移检查 |
| 样式 | `src/styles.css`、`src/pages/*.css`、`src/components/*.css` | 全局和模块级响应式样式 |

核心路由都在 `src/App.tsx`。不要另建路由系统，也不要把业务数据直接塞进页面 JSX。

## 4. 三个产品模块

### A. 校园办事指南

- **主数据**：`src/data/guides.json`。
- **共享线下服务点**：`src/data/service-windows.json`；地点、常规时间、电话应在此处维护，不要在多份指南中复制。
- **主要界面**：`src/pages/GuidePages.tsx` 和 `src/pages/guides.css`。
- **关键逻辑**：`src/lib/campusContent.ts`（搜索、路线/身份/校区适用性）、`src/lib/guideSections.ts`（详情“本页内容”目录）、`src/lib/campusPreference.ts`（校区偏好）。
- 详情允许不同身份或用途切换“办理方式”；用户主动选择优先于搜索推断。搜索、页码、路线等状态需要通过 URL 查询参数保持。

指南中的资料不是对学校业务的实时承诺。办理条件、费用、登录后菜单、设备位置或时效政策不明时，必须保留“待核实”边界并链接官方参考，而不是补写猜测。

### B. 浙大美食点评

- **主要界面**：`src/pages/FoodPages.tsx`、`src/pages/FoodPublishPage.tsx` 及同名 CSS。
- **空配置示例数据**：`src/data/foods.example.json`。它仅用于只读展示，发布或评分绝不能伪装成已共享保存。
- **真实共享模式**：浏览无须用户手动登录，底层保留匿名身份兼容旧记录；发布/管理前端要求已验证的浙大邮箱，原匿名身份通过邮箱绑定保留发布所有权。评分当前仍走匿名兼容路径，尚未完成“必须邮箱登录评分”的前后端统一。发布由RPC原子创建菜品和首次评分。不能把前端拦截当作云端最终权限开关已验收。
- **图片边界**：仅 JPG、PNG、WebP，最大 5 MiB；路径为“当前用户 UUID/随机 UUID.扩展名”。

### C. 校园信息源导航

- **数据**：`src/data/accounts.json`、`src/data/websites.json`，公众号配图在 `public/sources/裁剪后/`。
- **界面**：`src/pages/SourcePages.tsx`、`src/pages/sources.css`。
- 公众号、网站的整理来源和公开性边界见 `docs/content-provenance.md`。不要凭名称虚构认证、简介、二维码、微信深链接或实时状态。

## 5. 数据、来源与文档的职责

| 文件/目录 | 何时查看或修改 |
| --- | --- |
| `docs/project-requirements-v0.3.md` | 需求与最终规则的主要依据；先读再做大范围产品改动 |
| `docs/development-status.md` | 当前/历史迭代、验证范围、已知限制和下一步 |
| `docs/content-provenance.md` | 静态资料来源、可追溯字段、清洗与不确定性边界 |
| `docs/content-review/` | 各业务内容的官方核对证据与尚未核实项 |
| `README.md` | 面向开发者的项目说明、当前体验路径及本机检查 |
| `supabase/README.md` | 数据库、RLS、Storage、发布/评分契约和真实服务验收 |
| `src/data/content-manifest.json` | 内容规模、原始资料哈希和导入记录；资料更新时同步维护 |

若修改了指南、服务点、信息源或其检索逻辑，应同步检查相应的内容追溯/核对文档与测试，不能仅让页面“看起来能显示”。

## 6. Supabase 与凭据安全

本项目的美食功能有两种明确模式：

1. **无配置模式**：两个 Vite 变量都为空时，展示只读示例美食；发布和评分必须明确失败，不写入浏览器本地伪数据。
2. **共享服务模式**：仅当运行时代码确认 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY` 可用时，使用真实 Supabase。项目曾配置真实服务，但这不代表本机凭据、网络或云端权限当前可用。

安全规则：

- 从 `.env.example` 复制创建本地 `.env.local`；**不得**把 `.env.local`、`supabase-credentials.local`、任何私钥、service role 或会话 token 写入代码、文档、截图、日志或 Git。
- 浏览器端只能使用 Supabase 的 publishable key，绝不能使用 `service_role`。
- 迁移 `supabase/migrations/202610020001_initial.sql` 是新项目初始化脚本；已初始化的真实项目不要重复执行。结构变更应新建后续迁移。
- 不要用 localStorage、静态 JSON 或示例数据替代真实服务写入；网络错误必须如实显示。
- 真实数据库结构变更、云端函数部署、托管网站发布和校方系统操作，按具体授权执行；本轮个人中心交接不包含这些操作。源码Git同步按AGENTS.md及当前人类任务执行，不等于有权部署或改云端。

## 7. 推荐的 AI 工作流程

1. 先读本文件、`AGENTS.md`、相关需求/核对文档；再查看 `git status --short` 和受影响的源码、测试。
2. 把任务映射到最小责任文件：内容优先改 `src/data/`，交互逻辑改 `src/lib/` 或对应页面，样式放在既有 CSS 中。
3. 不创建 `*_v2`、`*_final` 之类副本，不复制静态数据，不覆盖别人的改动；临时分析材料仅放 `scratch/`，正式交付使用已有正式目录。
4. 对内容类改动，先核对来源再写入，并把“已核实”和“待确认”明确区分；对业务事实宁缺毋滥。
5. 最少运行受影响测试；改动 TS/页面后通常还需 `npm run typecheck`、`npm test`、`npm run build`。改迁移时加 `npm run test:db`。
6. 最后审查 `git diff --check` 和 `git status --short`。按AGENTS.md及当前人类任务提交并同步源码；协作任务优先推送功能分支、用PR审阅，不自行合并main、发布站点或执行云端迁移。

## 8. 常见边界与避免事项

- 不要把公开站点当作当前分支的验收结果；当前本地更新可能尚未发布。
- 不要因为某条链接属于学校域名，就声称其全部内容已实时核验。
- 不要承诺学校办理会成功、费用固定或窗口持续开放；指南应引导到官方入口并标记不确定条件。
- 不要删除 `source`、`sourceRows`、`sourceQuestions`、`aliases` 等追溯字段来“清理数据”。
- 不要重跑初始化迁移、修改 RLS 放宽权限，或绕过 RPC 直接插入菜品。
- 不要将 `dist/`、`node_modules/`、缓存、临时截图、真实环境文件或凭据加入 Git。

## 9. 给 AI 的最小提示词

将以下内容连同任务发给协作 AI，可快速限定其行为：

```text
请先阅读 docs/AI_PROJECT_HANDOFF.md、AGENTS.md 及与任务相关的 docs/ 和源码。
这是 React + Vite + TypeScript 的“浙大校园指南”课程原型；不是学校官方系统。
先运行 git status --short，保留现有改动。不要泄露 .env.local、supabase-credentials.local、密钥或 token；源码提交同步遵循AGENTS.md与本次任务；在个人功能分支工作，未经进一步授权不要合并main、发布网站或执行云端迁移。
办事内容必须可追溯，未知业务规则要标记待核实，不能编造。完成后给出修改文件、验证命令及结果、未验证的风险。
```

## 10. 首选入口索引

| 想了解什么 | 从哪里开始 |
| --- | --- |
| 页面与路由 | `src/App.tsx` |
| 办事指南搜索与详情 | `src/pages/GuidePages.tsx`、`src/lib/campusContent.ts`、`src/data/guides.json` |
| 美食发布/评分与云端 | `src/pages/FoodPublishPage.tsx`、`src/lib/foodService.ts`、`supabase/README.md` |
| 信息源导航 | `src/pages/SourcePages.tsx`、`src/data/accounts.json`、`src/data/websites.json` |
| 内容可信度和来源 | `docs/content-provenance.md`、`docs/content-review/` |
| 近期变更与测试边界 | `docs/development-status.md` |
| 需求与协作规则 | `docs/project-requirements-v0.3.md`、`AGENTS.md` |

## 11. 本轮交接：个人中心（2026-10-15）

后续新增（原PR #5，现已整合到PR #6并发布魔搭前端，main合并待组长审阅）：全站使用小组“浙里有方”Logo；账号操作栏统一对齐；`OwnedFoodList` 复用共享 `FoodImage` 展示右侧缩略图。用户另授权私有资料编辑，新增独立 `campus_account_details` 表及本人读取/保存RPC，支持性别、签名、常驻校区；需要组长只部署 `202610220001_campus_account_details.sql`，不重跑旧迁移，不启用五档案。云端未接入时明确显示待接入，真实跨设备保存待验收，详情见 [个人中心说明](personal-center.md)。官方学业内容现为102份指南与112个网站，年度、院系和来源边界见 [核对记录](content-review/guide-verification.md)。

原PR #5与未合入PR #3的只读 `git merge-tree` 试算发现以下5处文本冲突；现PR #6整合部署与说明清理后共9处，新增 `SourcePages.tsx`、`README.md`、`docs/AI_PROJECT_HANDOFF.md`、`docs/development-status.md`。未实际合并或改动main。来源页需保留双方收藏和资料披露，记录保留各轮证据；其余源码逐项保留：

- `src/App.tsx`：PR #3的路由按需加载/失败恢复/首页搜索，加上本轮Logo、标题与页脚；不要退回同步加载。
- `src/lib/foodService.ts`：收藏和个人资料的服务导出都保留，继续使用现有唯一Supabase客户端。
- `src/pages/FoodPages.tsx`：保留PR #3预算/排序/收藏/返回条件，本轮图片函数已移到 `components/FoodImage.tsx`，改用共享导入，删除重复内联实现。
- `src/pages/PersonalCenterPage.tsx`：同时保留我的收藏与本轮 `PersonalDetailsCard`，同级key用 `details:${id}` / `content:${id}` 区分，私有内容继续按账号重建。
- `supabase/test-runtime/run.mjs`：收藏与资料的独立迁移和两种结构权限测试都执行；资料不依赖五档案，测试夹具全部回滚。

整合后重跑双方Node、数据库和浏览器检查。本轮的360/235/54仅对应本分支，不能直接当作合并版结果。两份新增迁移独立审阅，云端只执行尚未部署的文件。

2026-10-17：个人中心工作在独立 `feat/personal-center` 分支实现，交付与复现入口见 [个人中心交付说明](personal-center.md)。新增评分历史增量迁移仅供审阅，未在云端执行；用户暂缓自己的真实邮箱注册与联调。功能分支或本地检查通过不表示已合并、发布或完成真实服务验收。以下目标与边界继续适用。

### 已确认与未完成

- 组长已本人确认浙大邮箱验证码登录成功。发件通道由现有Supabase管理，协作者不需要组长的Google登录、Google应用专用密码、邮箱验证码或Supabase管理登录。
- 一个邮箱是一个Auth登录账号；已有“同账号最多五个发布档案”代码，但迁移202610130002尚未执行云端，`VITE_FOOD_PROFILES_READY`保持false。本轮不扩展、移除或开启五档案，不把档案和Auth账号混为一谈。
- 初始迁移及202610130001已于先前阶段应用；仍应核对实际云端结构。282项Node检查、类型检查、构建通过是本地证据，不等于云端注销/评分权限/五档案已验收。
- 注销是独立的后续任务，不能用退出登录代替；本轮不实现会真实删用户的按钮、假成功提示或浏览器端管理员API。

### 第一轮目标和接入位置

1. 提供个人中心入口和页面：账号状态、仅本人可见的邮箱、我的发布、我的评分、退出登录；移动端布局完整，匿名用户看到清楚的登录入口及返回路径。
2. 复用 `src/hooks/useFoodAuth.ts`、`src/components/FoodAccountProvider.tsx` 和 `src/lib/foodService.ts`，不要另建登录体系、第二套Supabase客户端或第二份身份存储。
3. 复用 `/food/mine` 和已有编辑/撤下/恢复。我的评分如需要新增查询，放既有服务层，只查询当前已验证用户ID；不要加载所有用户资料后前端过滤，不查询或公开auth.users。
4. 路由从 `src/App.tsx` 接入现有账号Provider范围；页面放src/pages，CSS复用现有视觉变量和food-account.css。保留原搜索、分类、返回地址及验证码续接逻辑。
5. 不强行加入没有后端支持的昵称/头像编辑。可提出独立数据契约、增量迁移和本地测试，等审阅后再接入；不得把localStorage假保存当作跨设备个人资料。
6. 浏览指南、信息源、美食列表和详情继续公开；不修改评分资格、邮箱绑定、SMTP或云端档案开关。这些尚待组长统一处理。

### 同学所需材料

- 最新GitHub源码、本文、AGENTS.md、README.md、docs/development-status.md和supabase/README.md均在仓库。
- 真实登录联调另需一份本地 `.env.local`，只含项目URL、publishable key和功能开关。这两个客户端参数不是后台管理凭据，实际权限由服务端验证及RLS保证；仍需遵守用户权限，不使用管理密钥绕过。
- 组长可单独提供筛选后的配置文件；不要直接索要组长整份环境文件。保留在同学本机，不提交Git。没有配置时只读示例可用，但不能据此验收真实登录与个人数据。
- 同学用自己的浙大邮箱注册联调，必要时创建自己的独立Supabase测试项目。云端结构/部署权限仍由组长控制；不需要共享任何个人账号。

### 验收与交付

- 未登录个人中心引导正确；登录后只显示本人数据；刷新/返回不丢已登录状态；退出后不残留另一用户的个人内容。
- 在独立账号或模拟测试中核对跨用户隔离、加载/失败/空状态，禁止用组长账号完成个人测试。
- `npm ci`，`npm test`，`npm run typecheck`，`npm run build`；改SQL时加 `npm run test:db`。不要为了本地浏览而对真实数据库重复跑初始化迁移。
- 提交清晰的功能分支与PR，说明改动、测试、截图、是否需要新增迁移和未验收项；由组长审阅后合并，不自行部署站点。
