# 本机隔离界面检查

运行 `node tests/browser/fixture/server.mjs`，打开 `http://127.0.0.1:5182/account`。

此目录保存可复现的测试夹具。配置不会进入正式 Vite 配置、src 或打包入口；仅通过此独立测试服务器启用。
真实 App、路由、FoodAccountProvider、FoodAuthContext、页面和组件保持原样；仅 foodService 由 Vite 开发进程替换为内存夹具。CSP 禁止外部网络请求，envDir:false 不读取 .env.local。仅监听 127.0.0.1；不接收远程请求。

使用顶部可点击控件切换 A/B/未登录、空记录、读取失败、资料接口未接入和写入失败。保存与撤下只操作内存；刷新页面后恢复初始数据。真实保存、云端 RLS、验证码与跨设备同步需单独验收。

另开终端运行 `playwright-cli -s=brand-account open about:blank`，再运行 `playwright-cli -s=brand-account --raw run-code --filename=tests/browser/brand-account.js`。截图输出到忽略的 `scratch/brand-ui/`。该回归不读取已有浏览器配置、不创建真实用户、不进入生产测试会话。

建议逐项点击：
- /account 检查 A 的邮箱、发布和评分；切换 B 后不可残留 A；退出后个人内容收起。
- 有图、无图、图加载失败、已撤下四种发布；撤下确认与恢复；右侧图片手机不溢出。
- /food/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa 检查账号工具条文字居中、键盘焦点和手机换行。
- 个人资料编辑、取消、合法保存、错误不报成功；切换账号或退出不保留其他账号未保存字段。
- 320/375/390/1280 px 检查导航、长标题、长地点与控件，桌面和手机各存截图到 scratch。
