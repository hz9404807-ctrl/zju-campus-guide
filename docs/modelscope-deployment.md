# 共同使用的魔搭网站

## 组长直接使用

1. 浏览或分享：[魔搭共享网页](https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide?mode=full)。公开浏览无需登录魔搭，也无需下载或启动项目；网站内发布、评分和个人管理继续使用自己的浙大邮箱身份。
2. 开启后续自动更新：审阅 [PR #4](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/4) → **Merge pull request** → **Confirm merge**。本次空间、免费资源、部署 Secret 和 Variables 已配置，无需重复创建或重新提供令牌。
3. 合并后打开 [Actions](https://github.com/hz9404807-ctrl/zju-campus-guide/actions) → **ModelScope website** → main 最新运行，查看结果。绿色表示检查和部署请求成功；再到[魔搭空间](https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide)确认 **Running** 并实际打开网页。此流程的首次 Actions 运行仍待验证。
4. 以后双方把已审核的功能通过 PR 合入 main，等待同一流程更新即可。功能分支或 PR 本身不会发布；原 Sites 不随此工作流更新。[PR #3](https://github.com/hz9404807-ctrl/zju-campus-guide/pull/3)的新功能及迁移需单独审阅。

仓库首页右侧 **About** 的网址也指向魔搭共享网页。手机暂用[原 Sites 网页](https://zju-campus-guide.sangnuo0808.chatgpt.site)，魔搭外框限制见下文。

## 当前上线记录

2026-10-21已上线电脑共享预览：[打开浙大校园指南](https://www.modelscope.cn/studios/zzzhr777/zju-campus-guide?mode=full)。当前应用为main 25f2e69，镜像540d4223，公开免费Docker为Running。原Sites保留。GitHub接入已完成，PR #4审阅合入main后触发自动部署，Actions首次运行仍待验证。

**手机与刷新限制：** 魔搭的全屏外框在390px视口仍固定1280px。iframe内导航不会同步外层URL，外层刷新会回入口路径。直接深链会通过app_path恢复目标；电脑可用页面内导航和返回。当前把魔搭作为电脑共享预览，手机继续用原Sites，后续正式托管选择需考虑这两项限制。

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
