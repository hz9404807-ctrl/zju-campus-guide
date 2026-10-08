# 浙大校园指南

《人类工效学》课程的校园信息整合网站原型。名称暂定为“浙大校园指南”，由课程小组制作，不是学校官方产品。

项目围绕两个使用流程开发：搜索校园办事问题并查看解决办法；搜索美食、发布菜品并参与评分。第三模块暂时显示“正在整理中”。

## 当前进度：共享功能代码已准备，真实项目稍后连接

更新日期：2026-10-08。工程使用 React + Vite + TypeScript，首页、办事指南、美食列表和详情已通过本机检查。目前有 4 条明确标注的示例指南和 6 条虚拟菜品，第三模块显示“正在整理中”。

美食发布表单、单张图片预览、首次评分、相似菜品提示、已有菜品评分，以及 Supabase 连接代码和数据库迁移已经写好。TypeScript 检查与生产构建、164 项接口/表单自动测试、33 项本地数据库检查均通过。发布表单、图片预览、选星、搜索入口与失败提示已在本机浏览器检查，320、390、780 和 1280 像素宽度下未发现横向溢出。接口测试使用模拟客户端，数据库测试使用内存 PostgreSQL，不能替代真实 Supabase 服务验收；详细记录见进度文件。

组长账号和项目创建暂时留到后续。目前没有连接真实 Supabase：环境变量都留空时，页面进入明确标注的只读示例模式，发布和评分会提示没有提交，不会在本机制造共享数据。填写真实配置后才能连接匿名身份、数据库和图片存储。真实 Auth / Storage、两台设备共享、实际手机、第二台 Windows 电脑及线上部署仍未验收。

具体检查步骤见 [阶段进度与验收清单](docs/development-status.md)，原始需求保留在 [项目说明书](docs/project-requirements-v0.3.md)。说明书中第 56–71 节的最终规则及用户后续确认优先于早期描述。

## 在 Windows 上运行

1. 安装 Node.js 24 LTS。安装完成后重新打开终端。
2. 打开项目文件夹，在文件夹空白处右键，选择“在终端中打开”。终端所在位置应能看到 `package.json`。
3. 检查运行环境：

   ```powershell
   node --version
   npm --version
   ```

   Node.js 版本应以 `v24.` 开头。

4. 安装依赖：

   ```powershell
   npm install
   ```

5. 启动开发预览：

   ```powershell
   npm run dev
   ```

6. 在浏览器打开终端显示的 `Local` 地址：`http://127.0.0.1:5173`。如果提示端口已被占用，先关闭另一个项目预览，或者执行 `npm run dev -- --port 5174` 并打开新的地址。

保持终端打开，网页才能继续访问。修改代码后，开发页面会自动更新。在终端按 `Ctrl+C` 可以停止预览。

如果 PowerShell 提示不能运行 `npm.ps1`，可以在终端切换到“命令提示符”后执行同样的命令，或把命令中的 `npm` 改成 `npm.cmd`。

## 运行自动检查与生产构建

```powershell
npm test
npm run test:db
npm run build
npm run preview
```

`npm test` 检查表单验证和 Supabase API 调用契约，接口由测试替身提供；`npm run test:db` 在内存 PostgreSQL 中检查迁移、约束、访问权限与事务，使用最小 Auth / Storage 基础表。两种检查都不连接组长项目，也不能代替真实匿名登录、文件上传或多人共享测试。数据库检查的范围和后续云端验收见 [Supabase 配置与测试说明](supabase/README.md)。

`build` 检查 TypeScript 并生成 `dist` 文件夹；`preview` 在本机预览构建结果，通常使用 `http://127.0.0.1:4173`，以终端实际显示的地址为准。开发预览通常用 5173 端口，适合边改代码边看；构建预览通常用 4173 端口，用于检查生成后的页面。同学长期访问所需的线上部署将在后续阶段安排。

## 把项目交给另一台 Windows 电脑

复制或压缩项目文件夹，保留 `src`、`public`、配置文件、`package.json`、现有的 `package-lock.json`、`.env.example`、README、`docs`、`tests` 和 `supabase`。交接 ZIP 不包含 `node_modules`、`dist`、`.npm-cache`、`artifacts` 或任何真实环境变量文件；依赖和构建结果可以在接收电脑上重新生成。

接收者安装 Node.js 24 LTS，解压后按上面的步骤运行 `npm install` 和 `npm run dev`。不填写密钥也能查看示例页面和操作表单，但提交不会保存。另一台 Windows 电脑的完整迁移尚未实测。

后续接入 Supabase 后，组长应单独配置本机的环境变量文件。`.env`、`.env.local` 等实际配置文件应由 `.gitignore` 排除，不放入公共代码仓库；`.env.example` 只记录变量名称，不含项目密钥。

## 小组在 GitHub 上协作

公开代码仓库：[浙大校园指南](https://github.com/hz9404807-ctrl/zju-campus-guide)。组长打开链接可以先看 README 和 `docs/development-status.md`；需要下载工程时，点击 **Code → Download ZIP**，解压后按上面的 Windows 步骤运行。也可以使用同版本的本地交接压缩包。

后续开发完成并检查后，会把源代码、测试、数据库迁移和说明文档一起提交到同一个仓库。可以在 **Commits** 查看每次变化，在 **Issues** 记录问题或建议。仓库链接用于查看与下载代码，网站的公开访问地址会在部署后另行提供。

组员修改代码前先同步最新版本，完成后用清楚的提交说明记录改动。实际密钥不放进仓库；Supabase 账号及项目创建步骤继续留到后续执行。

## 后续开发安排

| 阶段 | 本阶段内容 | 当前状态 |
| --- | --- | --- |
| 1 | 工程初始化、首页、导航、统一样式和模块基础页 | 已通过本机检查 |
| 2 | 办事指南实时搜索、结果列表、完整详情和明确标注的示例数据 | 已通过本机检查 |
| 3 | 美食卡片、校内外分类、实时搜索和详情展示 | 已通过本机检查 |
| 4 | 匿名身份、数据库、访问权限和图片桶 | 连接代码与迁移已准备；真实项目稍后连接 |
| 5 | 发布美食、单图上传、首次评分和相似菜品提示 | 已实现并通过自动检查；真实上传与发布待验收 |
| 6 | 其他用户评分、防重复评分、平均分和评分人数 | 已实现并通过自动检查；云端及多人流程待验收 |
| 7 | 手机适配、加载状态、失败提示并完善界面 | 本机浏览器尺寸与故障提示检查已完成；实际手机待测 |
| 8 | 跨浏览器实测、同学访问测试、Windows 迁移和完整交接 | 说明与脚本已准备；跨设备及部署待验收 |

按用户最新要求，由开发者直接完成本机测试并继续可做的工作，组长创建账号和项目的操作先保留。连接真实项目后，再完成云端和两台设备的验收。

## 维护办事指南资料

办事指南保存在 `src/data/guides.json`，目前有 4 条示例，全部设置为 `isExample: true`。字段定义见 `src/types/guide.ts`。页面根据这个文件搜索和展示资料。

普通组员可以把收集到的问题、办理步骤、材料、地点、开放时间、联系方式、官方链接和核验日期交给开发者整理，不需要自己猜字段或修改代码。

开发者新增指南时，复制一个现有对象，填写下列字段，并使用不重复的 `id`。文件整体是 JSON 数组，新增对象后执行 `npm run build`，再在页面搜索标题和关键词、打开详情检查。

| 字段 | 内容与格式 |
| --- | --- |
| `id` | 唯一标识，例如简短的英文问题名称；不能与其他指南重复 |
| `title` | 同学会问的问题标题 |
| `category` | 所属分类，例如“校园卡” |
| `keywords` | 搜索关键词数组，例如 `["校园卡", "补办"]` |
| `summary` | 一句话说明，字符串 |
| `steps` | 办理步骤数组，每一步一条字符串 |
| `materials` | 所需材料数组；未知可写“待补充 / 待核实” |
| `location` | 办理地点，未知填 `null` |
| `openingHours` | 开放时间，未知填 `null` |
| `contact` | 联系方式，未知填 `null` |
| `references` | 参考资料数组，每项是 `{ "label": "资料名称", "url": "实际来源链接" }`；尚无核实链接时填 `[]` |
| `source` | 资料来源说明，未知填 `null` |
| `verifiedAt` | 最后核验日期，使用 `"YYYY-MM-DD"` 格式；未核验填 `null` |
| `isExample` | 示例填 `true`；实际资料核验后才能改为 `false` |

没有核实的内容用 `null` 或“待补充 / 待核实”，不要猜办理入口、费用或时间。补上一个真实标题不代表整条指南已经核验；确认来源和实际流程后，才能去掉示例标记。示例内容不能当作学校正式规定。

## 美食数据与 Supabase 约定

`src/data/foods.example.json` 只用于演示页面。当前 6 条菜品、地点、价格、平均分、评分人数和短评标签均为虚拟示例，不能当作正式数据或真实推荐。后续真实美食由 Supabase 保存和共享。

美食共享数据使用 Supabase：`foods` 保存菜品，`ratings` 保存评分，`food-images` 存储图片。初始化迁移已保存在 [`supabase/migrations/202610020001_initial.sql`](supabase/migrations/202610020001_initial.sql)，包含表、行级访问策略（RLS）、评分统计视图、发布事务和图片桶配置；这些内容尚未部署到真实项目。执行说明见 [Supabase 配置与测试说明](supabase/README.md)。

V1 每个匿名身份对每道菜只能评分一次，不支持修改，前台不提供删除操作。发布菜品时同时提交第一次评分。换设备、换浏览器或清除浏览器数据可能产生新匿名身份，因此这个限制针对匿名身份。

前端只使用项目 URL 和公开的 publishable key，变量名称见 `.env.example`。不要把 `service_role` 或其他服务器私密密钥放进前端代码、`VITE_` 环境变量或公共仓库。

组长后续创建 Supabase 项目并持有管理权限，操作步骤保留如下。当前 `.env.example` 中两项变量都留空时使用示例模式；只填一项、格式有误或配置后的请求失败都会显示错误，不会悄悄切回示例数据。修改环境变量后须重启开发预览；生产构建需重新执行 `npm run build`。

## 组长创建 Supabase 的步骤

以下步骤留到后续执行，现在无需为本机检查创建账号。组长使用自己的账号创建项目，小组之后使用这个项目保存和共享美食数据。

1. 打开 [Supabase 控制台](https://supabase.com/dashboard)，登录组长自己的账号；没有账号时由组长自行注册。
2. 点击 **New project**，选择由组长或小组管理的组织。没有组织时先点击 **New organization**，填写名称并选择 **Free**。本原型先使用免费方案，具体额度见 [Supabase 定价说明](https://supabase.com/pricing)。
3. 项目名称填写 `campus-guide`。数据库密码由组长设置并自己保存，不需要发给开发者。
4. 在 **Region** 中优先选择 **Southeast Asia (Singapore)**；如果界面只列出地区组，选择 **APAC** 即可。点击 **Create new project**，等待项目创建完成并显示 ready。区域名称和可选区域见 [官方区域说明](https://supabase.com/docs/guides/platform/regions)。
5. 打开项目的 **Connect** 对话框，选择 **React**，复制 **Project URL** 和以 `sb_publishable_` 开头的 **Publishable key**。如果对话框中没有显示该密钥，可以到 **Settings → API Keys** 找到 Publishable key。获取方式见 [官方 API Keys 说明](https://supabase.com/docs/guides/getting-started/api-keys)。
6. 只把 **Project URL** 和 **Publishable key** 这两项发给负责接入的开发者；数据库密码、`service_role` 和服务器私密密钥不需要发送。
7. 在左侧打开 **Authentication → Sign In / Providers**，开启 **Allow anonymous sign-ins** 或 **Anonymous Sign-Ins**，点击 **Save**。该设置让同学无需填写邮箱或密码即可获得匿名身份。相关说明见 [匿名登录](https://supabase.com/docs/guides/auth/auth-anonymous) 和 [身份认证配置](https://supabase.com/docs/guides/auth/general-configuration)。
8. 按 [Supabase 配置与测试说明](supabase/README.md#后续连接组长项目时)，在新项目的 **SQL Editor** 完整执行初始化迁移一次。它会创建业务表、访问规则和 `food-images` 桶。确认该桶为公开读取、最多 5 MiB，允许 JPG / PNG / WebP；保持 `campus_private` 不在公开 schema 列表中。
9. 将工程根目录的 `.env.example` 复制为 `.env.local`，填写项目 URL 和 publishable key。重启预览或重新构建，检查页面是否读取真实项目。
10. 由开发者完成匿名会话、发布图片、第二个浏览器读取与评分、重复评分拒绝及失败提示的真实服务验收。详细清单见 [真实服务检查项](supabase/README.md#验证方式与实际限制)。

如果菜单或按钮名称与上述步骤不同，把当前页面截图交给开发者，按实际界面继续指导。表结构和权限已经在迁移文件中准备好，组长不需要自行设计或逐张建表。
