# 浏览体验修复（2026-10-20）

本轮从 `origin/main` 的 `a33896e` 创建 `fix/browse-experience`。保留已有个人中心和邮箱写入权限；用户要求暂时保留视觉样稿，本轮不切换视觉方案。

## 变化

- 信息源的“常用网站 → 查看办理步骤”会记住原列表的类型、搜索、类别和页码。指南里的返回入口会回到原信息源列表，刷新或切换办理方式也保留。修复“校园交通”被带进指南分类后出现零结果的问题。
- 跨栏目链接只把问题和办理路线用于指南内容，来源列表条件保存在受限的本站返回地址中。兼容旧的 `kind=websites` 指南链接；不接受外站、协议相对地址、其他路由或嵌套返回地址。
- 指南、公众号与网站的分页只接受有效的正整数页码，异常值回到第一页，合法的过大页码按实际总页数夹取。翻页完成后，键盘焦点和画面一起移到结果标题，并避开顶部固定导航。
- 美食搜索和分类直接筛选当前已加载的共享列表。输入关键词不再反复请求整份列表、清空卡片；“刷新列表”、加载失败和重试继续请求真实服务。

没有新增依赖或数据库迁移，没有修改 SMTP、账号规则、功能开关或真实业务数据，也没有发布托管网站。

## 自动检查

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

343 项 Node 测试、类型检查和生产构建通过。既有 SMTP 诊断回归使用本机模拟服务器，需要允许环回连接；受限沙盒首次检查因 `EACCES` 失败，在允许环回连接的环境重跑后全量通过，没有连接真实 SMTP。

未改 SQL，无需本轮新增数据库迁移或重复初始化。构建仍有既有的单个 JS 分块超过 500 kB 提示；按路由分包是后续可单独实施的性能优化。

## 隔离浏览器复现

沿用 [个人中心的隔离测试启动配置](personal-center.md#可复现的隔离浏览器检查)，在单独进程启动 `127.0.0.1:5176`。测试使用虚构 Supabase 域名，拦截全部非本机请求，不使用真实邮箱、验证码或管理凭据。

```powershell
playwright-cli -s=browse-navigation open about:blank
playwright-cli -s=browse-navigation --raw run-code --filename=tests/browser/browse-navigation.js
playwright-cli -s=browse-navigation close

playwright-cli -s=food-search open about:blank
playwright-cli -s=food-search --raw run-code --filename=tests/browser/food-search.js
playwright-cli -s=food-search close
```

- 跨栏目与分页共 26 项通过：来源分类与页码恢复、前进后退、刷新、办理方式切换、旧链接兼容、普通指南返回、异常页码、键盘及鼠标翻页、1440/390/320 px 布局。没有真实外部请求或未捕获浏览器异常。
- 美食共 20 项通过：多次关键词、类别、地点、校内外、手机筛选均不增加列表请求，也不中断已加载卡片；显式刷新发起请求，持续失败显示错误，恢复服务后重试成功。SDK 自身的 503 重试保留，不把它误算为搜索触发。
- 桌面与手机截图已本机目视检查，位于被忽略的 `scratch/browse-experience-desktop.png`、`scratch/browse-experience-390.png`、`scratch/browse-experience-320.png`、`scratch/food-search-desktop.png`、`scratch/food-search-mobile.png`。美食画面明确使用测试夹具，截图不进入 Git。

## 本人体验路径

启动本机网站后：

1. 信息源导航选择“常用网站”，类别选“校园交通”，点击班车网站的“查看办理步骤”；刷新或换一种办理方式，再点“返回信息源列表”，应仍是校园交通的四个网站。
2. 在全部常用网站的第 2 页进入一份指南，再返回，仍停在第 2 页。
3. 指南列表用 Tab 找到“下一页”并按 Enter，画面和焦点应一起到达新结果标题；手机不应被顶部导航挡住。
4. 美食列表加载后连续输入关键词、切换分类，卡片直接筛选；只有主动刷新或重试才重新获取列表。

以上为本机浏览器与模拟接口验证，没有声称完成真实手机、其他浏览器、云端网络故障或跨设备验收。共享美食的最新增删变化仍通过进入列表、主动刷新或重试获取。
