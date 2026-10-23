# 本机隔离界面检查

运行 `node tests/browser/fixture/server.mjs`，打开 `http://127.0.0.1:5182/account`。

此目录保存可复现的测试夹具。配置不会进入正式 Vite 配置、src 或打包入口；仅通过此独立测试服务器启用。
真实 App、路由、FoodAccountProvider、FoodAuthContext、页面和组件保持原样；仅 foodService 由 Vite 开发进程替换为内存夹具。CSP 禁止外部网络请求，envDir:false 不读取 .env.local。仅监听 127.0.0.1；不接收远程请求。

使用顶部可点击控件切换 A/B/未登录、空记录、读取失败、资料接口未接入和写入失败。保存与撤下只操作内存；刷新页面后恢复初始数据。真实保存、云端 RLS、验证码与跨设备同步需单独验收。

个人子页与分页回归：运行 `playwright-cli -s=personal-records open about:blank` 后执行 `playwright-cli -s=personal-records --raw run-code --filename=tests/browser/personal-records.js`。A 有 14 条本机记录、B 有 1 条，覆盖每页 6 条、详情返回、刷新/浏览器返回、越界页、图片与撤下隐藏、失败重试、空数据、切号和登录续接；截图在忽略的 `scratch/personal-records/`。这些数据不进入生产站点。分页只改变本人结果的显示，不改变已有身份校验、RLS 或评分资格。

另开终端运行 `playwright-cli -s=brand-account open about:blank`，再运行 `playwright-cli -s=brand-account --raw run-code --filename=tests/browser/brand-account.js`。截图输出到忽略的 `scratch/brand-ui/`。该回归不读取已有浏览器配置、不创建真实用户、不进入生产测试会话。

手机触控与资料折叠回归：保持上述夹具服务器运行，从仓库根目录执行：

```powershell
playwright-cli -s=mobile-navigation open about:blank
playwright-cli -s=mobile-navigation --raw run-code --filename=tests/browser/mobile-navigation.js
playwright-cli -s=mobile-navigation close
```

脚本创建独立的触控浏览器上下文，不读取已有用户会话。每个 320/375/390 px 宽度执行 18 项，共 54 项：覆盖首页提醒移除、Logo、入口与手机菜单导航、资料说明触控和Enter折叠、无横向溢出；另检查正常动画模式下先滚动再按文字坐标触摸、44px点击区、真实外链href及新窗口请求、复制成功值与失败后的原链接。外部请求在本机拦截，不访问官方站点，剪贴板成功/失败由夹具控制。390 px 页面截图保存在忽略的 `scratch/mobile-release/`。这些是本地隔离界面检查，不代表手指滑动、真机、魔搭外框或云端登录已验收。

建议逐项点击：
- /account 检查 A 的邮箱、资料和两张子页入口；/account/posts 与 /account/ratings 各自分页；切换 B 后不可残留 A，退出后个人内容收起。
- 有图、无图、图加载失败、已撤下四种发布；撤下确认与恢复；右侧图片手机不溢出。
- /food/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa 检查账号工具条文字居中、键盘焦点和手机换行。
- 个人资料编辑、取消、合法保存、错误不报成功；切换账号或退出不保留其他账号未保存字段。
- 320/375/390/1280 px 检查导航、长标题、长地点与控件，桌面和手机各存截图到 scratch。
