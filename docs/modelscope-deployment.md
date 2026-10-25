# 共同使用的魔搭网站

## 10月25日部署状态：访问已恢复

手机版首页、反馈精简、排序及公开美食读取修复已在[PR #9](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/9)。当前原空间Running，runtime于10月25日12:33:48 UTC创建，公网运行来源 `b8e9f5d32216a9169b4230dffaa44ab3263ffda8` / connected，16项HTTP及46项生产手机访客浏览器检查通过。原共享网址恢复访问，免费资源、账号及业务数据未改。

原c311ffb构建后长期Deploying并进入DeployFailed，公网404/412，镜像构建无错误但运行日志为空；运行配置与上一正常d3287a0完全相同。[诊断](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/40188114244)及[一次停止再启动](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/40188414117)后，管理页确认无文件/配置变更并重部署同一构建，12:21 UTC恢复Running。平台未提供具体内部原因。独立[容器检查40192744562](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/40192744562)实际启动相同运行文件与基础镜像，Node24.22.1、healthy、五条路径200，不把这一结果当作已定位平台内部原因。

恢复后发现公开美食读取先依赖匿名注册，已最小移除listFoods/getFood的显式身份初始化。修复[发布40193293791](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/40193293791)的安装、425项测试、类型检查、构建和镜像仓Git推送成功，但POST deploy返回400导致工作流失败；随后在管理页核对仅网页文件变化、配置0变更并确认部署，才上线当前b8e9f5d。此次没有验收自动部署全流程，main永久流程保持原样，后续需单独验证API触发成功。

生产浏览器用单一新Android14上下文检查375/390px、真实校内24道菜的四方向排序及返回；全部非读auth/rest/storage请求被拦，旧匿名初始化10次被阻止、业务/验证码/Issue尝试0，无真实登录或写入验收。应用pageerror0、ModelScope/g.alicdn宿主10分别记录；未知价/无评分生产样本0，仅本机回归覆盖。临时容器与修复发布流程已在交接清理时移除；原Sites保持，main未合并，PR #9→#8→#7审核链不变。截图及详细边界见development-status.md。

## 上一正常运行版本（2026-10-24）

问卷反馈优化已通过[ModelScope feedback release](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/40086456065)更新同一个免费空间，源码 `codex/user-test-feedback` / [PR #8](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/8)。公开运行来源 `d3287a042cc15a05b854e6cc99a2e9b0baa0428c`、connected，API为Running；16项HTTP检查通过。main仍25f2e69，PR #8以未合并PR #7分支为基线；建议先审核PR #8合到该分支，再审核PR #7整体合main，避免main自动部署旧中间版。站点更新无需提供新令牌或账号。

本次沿用原Secret/公开变量/免费Docker，永久main工作流不变；一次性流程只允许当前仓库、精确分支和原Studio，在16项HTTP及87项生产访客检查通过后已删除。无数据库结构、SMTP、五档案和业务数据变更；资料迁移与样例清理继续独立处理，原Sites不变。生产检查为单一移动UA四宽，宿主异常20与应用异常0分别记录，不能替代实体鸿蒙/真实账号。详见开发记录；后续交接/临时流程清理提交不改变上述运行来源。

## 上一轮运行版本（2026-10-23）

用户随后明确要求立即更新GitHub和魔搭，已使用现有令牌、公开客户端配置及免费空间，通过 [ModelScope polish release](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/39944450516) 发布 `codex/saturday-polish`。公网 `/release.json` 为 `661e561ea677f626a4ec197d722809826dfc69a4`、`connected`，公开API确认Running，资源仍为 `platform/2v-cpu-8g-mem`。16项只读HTTP检查覆盖精确版本、健康、个人子页等深链、Logo和JS/CSS MIME及缓存、缺失脚本和敏感路径404。

本轮PR #7已包含PR #6及PR #4/#5；main仍为25f2e69，待组长审阅合并，原Sites保持不变。临时发布流程仅允许当前仓库、精确分支和既有Studio，令牌只在最后部署步骤注入；16项HTTP及92项生产访客检查完成后已删除临时工作流，永久main流程保持原样。后续文档/工作流清理提交不改变上述运行来源。4条样例未撤下，资料迁移未在云端执行，均按原独立交接处理。手机UA、宿主异常与真实登录验收边界见最新开发记录。

## 上一轮发布记录

共享网址不变。本次用户明确要求更新网站，已把PR #4/#5整合到 `fix/mobile-release`，运行 [ModelScope mobile release](https://github.com/hz9404807-ctrl/zju-campus-guide/actions/runs/39904983944) 成功；公网 `/release.json` 返回 `5db6f58e15a9edb9bf3deb0efb9d945acf25926f`、`connected`，浏览器HTML请求下主页/美食/来源/账号/新指南及Logo资源返回200，健康检查正常。源码交付为 [PR #6](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/6)，main合并及首次main自动更新待组长验收。

一次性push工作流仅用于本次固定分支发布，已在验收后的清理提交删除；该提交仅改变文档与工作流，不改变上述线上应用来源。永久main工作流保持PR #4设计。组长审阅PR #6后合入main即可启用后续main更新，不必重新提供部署令牌或创建空间。个人资料的新增SQL本次没有在云端执行，仍按个人中心交接接入。

旧记录中的390px固定1280px是此前窄窗口检查结果。本轮手机触摸UA下320/375/390px已正常按视口显示。模拟器自动定位跨iframe后立即点击文字时，曾只命中宿主而未送入应用；先滚到可见并稳定后点击通过。外链已发出官方站点的页面导航请求，目的站正文未完成响应，不能当作失效或宣称已成功打开。新版扩大入口触摸区，并提供外链复制及失败后的手动备用。实体鸿蒙、微信和真实浙大邮箱登录仍待验收，具体截图见最新开发记录。以下首次上线与接入内容保留作历史及重建参考。

## 组长直接使用

1. 浏览或分享：[魔搭共享网页](https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide?mode=full)。公开浏览无需登录魔搭，也无需下载或启动项目；网站内发布、评分和个人管理继续使用自己的浙大邮箱身份。
2. 当前更新已在魔搭运行；建议先在 [PR #8](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/8)审核并合到其目标 `codex/saturday-polish` 功能分支，再审核 [整合PR #7](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/7)合main。这样main一次接入当前完整代码；PR #7已含PR #6及PR #4/#5，无需重复应用旧PR。本次空间、免费资源、Secret和Variables已配置，无需重复创建或重新提供令牌。
3. 合并后打开 [Actions](https://github.com/hz9404807-ctrl/zju-campus-guide/actions) → **ModelScope website** → main 最新运行，查看结果。绿色表示检查和部署请求成功；再到[魔搭空间](https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide)确认 **Running** 并实际打开网页。本次分支Actions已成功，main首次自动运行仍待合并后验收。
4. 以后双方把已审核的功能通过 PR 合入 main，等待同一流程更新即可。功能分支或 PR 本身不会发布；原 Sites 不随此工作流更新。[PR #3](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/3)的新功能及迁移需单独审阅。

仓库首页右侧 **About** 的网址也指向魔搭共享网页。[原 Sites 网页](https://zju-campus-guide.sangnuo0808.chatgpt.site)作为版本独立的备用入口；手机触摸验收与魔搭外框问题见最新开发记录。

## 首次上线记录（2026-10-21）

2026-10-21首次上线电脑共享预览：[打开浙大校园指南](https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide?mode=full)。当时应用为main 25f2e69，镜像540d4223，公开免费Docker为Running。原Sites保留；当时Actions首次运行仍待验证。本轮实际发布以顶部版本记录为准。

**首次窄窗口检查：** 当时390px视口出现固定1280px外框，本轮手机触摸UA已正常适配，不能将旧观察推广到所有手机。iframe内导航不会同步外层URL，外层刷新会回入口路径；直接深链通过app_path恢复目标。手机点击和外部网站跳转需分别验收。

GitHub 保存代码；Sites 和魔搭分别运行某次构建。推送代码不会自动改变既有 Sites 网页。小组应约定一个共享网址，功能分支通过 PR 合入 main 后，由 main 的工作流更新这个网址。任何人的本机预览、旧 Sites 站点仍是独立版本。

## 本次准备的流程

`.github/workflows/modelscope.yml` 仅在 main 且 `MODELSCOPE_DEPLOY_ENABLED=true` 时运行。它安装锁定依赖、运行测试与类型检查、构建、准备允许清单中的文件，再向同一个魔搭 Studio 普通推送，最后显式请求部署。部署串行进行，不强推；PR 不获得部署令牌，也不发布。工作流无需向 GitHub 写代码。

应用仍是原 React 网站和原 Supabase。未更改数据库、SMTP、邮箱权限或五档案开关。换网址后浏览器需重新登录；不要迁移任何人的会话或验证码。

选择 Docker 是为了正确处理 `/food`、`/account`、`/sources` 和指南详情直接打开及刷新。运行容器仅含已构建网页和无依赖 Node 静态服务，不运行开发服务器。`index.html` 重新校验缓存，带哈希资源长期缓存；缺失脚本真正返回404。

## 首次接入参考（本次已完成配置）

1. 在 [魔搭](https://modelscope.cn/studios) 注册并登录。平台若要求实名认证、阿里云绑定或条款确认，由本人在官方页面完成，不共享身份证、密码或验证码。Docker 的前置条件见[官方模板](https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/references/docker-templates.md)。
2. 创建**公开 Docker 创空间**，例如 `你的用户名/zju-campus-guide`，仅选择当前界面明确免费的 CPU 资源。先查实时可用配置和免费额度；无免费资源就停止，不购买资源、不自动换付费档。官方只说明免费额度可能受限，不能承诺永不休眠。
3. GitHub 仓库 → Settings → Secrets and variables → Actions → Variables，配置下表。项目 URL 与 publishable key 是网页本来就需要的公开客户端配置；不要填写后台密钥。继续连接组长已有的 Supabase，不新建替代数据库。

| Variable | 内容 |
| --- | --- |
| `MODELSCOPE_STUDIO` | 本次实际创建的 `owner/repo` |
| `VITE_SUPABASE_URL` | 原项目 HTTPS URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 原项目 `sb_publishable_…` 客户端 key |
| `VITE_FOOD_EMAIL_AUTH_READY` | 与已验证现有站点一致，不能擅自开启 |
| `MODELSCOPE_DEPLOY_ENABLED` | 首次核对完成前不填，之后设为 `true` |

五档案在工作流中固定 `false`。未配置真实共享服务时正式打包会报错，不会悄悄发布示例菜品。

4. 账号持有人在魔搭官方页面创建最小可用权限的访问令牌，直接保存到 GitHub 同页面 **Secrets → New repository secret → `MODELSCOPE_TOKEN`**。不要发到聊天、写进 Git remote、环境文件、前端变量或截图。此令牌允许工作流更新指定创空间，保护好 GitHub main 的合并权限；不用时在魔搭撤销令牌。
5. 新空间若自带 README，先只读核对它确实是本次新建、仅含初始 README/.gitattributes 的空间。把核对过的 master 完整 SHA 填入可选 Variable `MODELSCOPE_BOOTSTRAP_COMMIT`。脚本只在这一 SHA 精确匹配时允许首发，不能用来覆盖其他项目；后续凭本项目镜像标记识别。首发成功后可移除此 Variable。
6. 审阅并合并本部署 PR 后，main 的更新会自动触发 Actions → **ModelScope website**；若需手动重跑，可用 **Run workflow** 并选择 main。不要为部署直接合并尚未审核的功能 PR。

脚本不自动建空间、不改资源或可见性。它会查询现有 Studio 与 hardware 信息，只有明确确认公开 Docker 和免费资源才继续；API 字段不明时停止供人工核对。Git 推送后调用[官方 deploy 接口](https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/references/openapi-studio-endpoints.md)，成功仅代表**部署请求被接受**，首次上线还必须查看魔搭构建/运行状态与实际网页。不要把工作流绿灯写成云端端到端验收通过。

## 本机检查和首次验收

```powershell
npm ci
npm test
npm run typecheck
npm run build
# 与上一步构建使用同一份公开客户端环境变量。
node --env-file=.env.local scripts/modelscope-release.mjs prepare
```

部署脚本运行在 GitHub 的 Linux runner，token 仅注入最终步骤。只打包 `dist/`、`Dockerfile`、`server.mjs`、镜像说明和版本清单；不打包源码、`.env*`、会话、原始临时材料。`prepare --allow-demo` 仅供本机检查，此产物会被 deploy 拒绝。

首次应逐项点击：

- 首页 → 办事指南 → 某指南；复制详情链接在新标签直接打开并刷新。
- 公众号目录 → 详情 → 来源截图；目录和截图都正常。
- 美食 → 筛选 → 详情 → 返回；原条件保留。
- 个人中心访客入口 → 用自己的浙大邮箱登录 → 本人数据 → 退出；不测试组长账号。
- 手机宽度打开以上页面；浏览器控制台无脚本 MIME/404 错误。
- 验证发布版本 `/release.json` 中的 `sourceCommit` 与预期源码提交一致；只读核对真实美食，不能把演示数据当共享服务验收。

魔搭会把ms.show浏览器访问跳转到平台全屏页，并用app_path保留入口路径与查询。分享上面的干净全屏链接或目标内容链接；iframe临时参数不作为分享地址保存。登录应在实际平台容器中验收浏览器存储和返回路径；需要后台管理员接入的新域名设置时集中交接。

## 失败及回退

- 身份、免费额度、未知配置或并发推送失败：保留原在线版本，查看平台状态，不自动切付费、不强推。
- 推送成功但构建/运行失败：Git 中保留镜像历史，先看魔搭日志。不要自动反复重启或宣称已更新。
- 暂停自动部署：将 `MODELSCOPE_DEPLOY_ENABLED` 设为 `false`。
- 网页回退：在 GitHub 对已审阅的应用提交做 revert，经 PR 合回 main 后重新部署。若 main 尚不可用，在魔搭选择明确保存的历史版本恢复，再记录实际运行版本；不对 GitHub 或魔搭强推。
- 原 Sites 网站未被修改，过渡期间仍可使用，但不能把它视为自动同步站点。

实际完成程度和测试结果统一记录在 [开发记录](development-status.md)，本说明不替代上线记录。
