# Supabase 数据库与图片配置

## 2026-10-13 浙大邮箱登录与作者管理：配置及开通步骤

本轮代码、迁移和本地测试已完成，云端尚未应用新迁移，SMTP尚未配置，真实邮件/绑定/跨设备作者管理尚未验收。用户已明确先完成实现和配置步骤。当前本地预览的邮箱发送开关为false，页面明确暂未开放；没有伪造成功或写入测试邮箱。

### 1. 准备发信服务

准备项目专用发信地址、SMTP主机、端口、用户名、SMTP密码/授权码；有自有域名的服务按供应商完成发信域名验证及DNS设置。发件人不必是浙大邮箱。密钥只填Supabase后台或服务端秘密配置，不放VITE变量、源代码或Git。默认Supabase邮件服务仅向项目团队地址发信，不适合面向同学开放；不通过把所有同学加入管理团队来绕过。

### 2. 在Supabase配置认证及模板

- 在Authentication设置里配置Custom SMTP及发件人；测试发送到可收信的浙大邮箱，检查收件箱、垃圾箱、延迟、重发与供应商发送限制。
- 保持Email provider和邮箱确认开启；为了绑定现有匿名身份，开启manual linking。保留Anonymous Sign-ins供浏览和既有评分身份使用。不要关闭邮箱确认来模拟已验证账号。
- 编辑Magic Link/OTP及Change Email Address两种邮件模板，都显示 `{{ .Token }}`。参考模板：`<h2>浙大校园指南验证码</h2><p>你的验证码：<strong>{{ .Token }}</strong></p><p>请回到刚才的网页输入验证码。如果不是你操作的，请忽略此邮件。</p>`。本前端验证6位OTP，不依赖邮件链接回调，首次匿名绑定使用email_change验证，已有账号使用email验证。
- 邮件主题建议“浙大校园指南邮箱验证码”；不宣称学校官方系统，不收取邮箱密码。更换已绑定邮箱涉及旧新邮箱确认，当前前端不提供换邮箱入口，也不关闭安全确认设置。

### 3. 应用新增数据库迁移

先备份数据库并审阅 `migrations/202610130001_food_email_management.sql`，在已初始化的项目执行一次；不要重复执行initial。新增updated_at/deleted_at、学校邮箱域名触发器和两个作者RPC；通过auth.users的真实验证状态判定身份，覆盖email与email_change（注册、绑定、变更），不信任前端作者ID或user_metadata。直接修改foods、创建者和评分的权限仍关闭；campus_private仍不得加入Exposed schemas。

新增迁移的require_email初始false，便于现有匿名版本过渡，不等于正式邮箱限制已开启。修改/删除/恢复接口始终要求已验证浙大邮箱且本人是作者。公共读取从数据库策略就排除已删除记录；验证作者可在自己的列表中管理恢复。图片更新只接受本人目录中存在的本项目对象；不用覆盖上传。

### 4. 小范围真实验收后开启

在本地 `.env.local` 设置 `VITE_FOOD_EMAIL_AUTH_READY=true` 并重新构建，仅用于完成SMTP和迁移后的真实试用。依次验证：

1. 在原发布浏览器选择“首次使用/绑定本浏览器的发布”，检查Auth用户ID前后相同，已有菜品及评分归属保留。
2. 换另一浏览器或设备选择“已有邮箱账号登录”，同一邮箱能看到同一“我的发布”；已注册邮箱与另一旧匿名身份的合并本轮不自动处理，不凭邮箱认领他人数据。
3. 非浙大邮箱、未验证身份、伪造user_metadata和他人菜品修改/删除都失败。确认SMTP失败/错码/过期不会显示已登录。
4. 编辑文字与新图片，原评分不改变；双页面旧版本保存被拒绝；删除后公共列表、直接详情、foods及ratings API均不显示该内容，作者可恢复，恢复后的平均分/人数与原评分一致。
5. 退出后不能管理；登录后评分面板重新按当前身份加载。测试只用明确标注的验收菜品，避免删除真实用户内容。

所有真实检查通过后，再将服务端发布入口切为邮箱必需：

```sql
update campus_private.food_auth_settings set require_email = true where singleton;
```

这会使旧匿名前端无法发布，需与新前端正式上线协调；本轮没有执行。前端READY开关只控制可用提示，不替代数据库权限。真实发信、Auth服务、Storage及跨设备链路未验收前，不宣布功能开通。

### 5. 数据保留及回退

“删除”是可恢复撤下，不物理删除菜品、评分或图片；公开图片URL不自动失效。编辑上传后保存失败可留下未引用图片，原图/原菜品不会被覆盖；清理由管理员通过Storage API/界面单独处理。没有授予用户任意删除Storage对象的权限。

云端尚未迁移时，保留当前改动后可切回feat/guide-service-access的89c3500，或revert本轮聚焦提交，再重新构建本地预览。将来若已应用迁移，不通过删列、清空表或重新跑initial回退；先停用邮件入口并审阅权限和已删除记录，保留业务数据。

依据：[SMTP](https://supabase.com/docs/guides/auth/auth-smtp)、[OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[匿名绑定](https://supabase.com/docs/guides/auth/auth-anonymous)、[模板变量](https://supabase.com/docs/guides/auth/auth-email-templates)。下方是此前初始化版本的记录。

本目录保存可以随工程交接的数据库结构、访问权限和验证脚本。**2026-10-08组长本机已连接真实 Supabase，执行初始化迁移并完成17项真实服务检查及网页发布/评分验收。** 云端保留明确标注的验收数据。具体记录见 `../docs/development-status.md`。本地SQL检查和同一浏览器的两个独立origin检查均不能替代实际跨设备验收。

## 文件

- `migrations/202610020001_initial.sql`：首次初始化迁移，包含两张业务表、评分统计视图、发布事务和图片桶权限。
- `tests.sql`：数据库权限与事务测试，所有测试记录及临时修改最终回滚。
- `test-runtime/`：可选的本地内存 PostgreSQL 检查工具。它模拟最小 Auth / Storage 表结构，不访问 Supabase，不安装系统数据库服务。

## 后续连接组长项目时

组长本机已完成接入；此处保留新项目配置步骤。已初始化的项目不要重复执行首次迁移。

1. 由组长创建并持有一个新的 Supabase 项目。此迁移按新项目设计；不要直接套到已存在同名表、存储桶或其他宽松 Storage 策略的项目上。
2. 在项目的 SQL Editor 新建查询，粘贴 `migrations/202610020001_initial.sql` 的完整内容，以项目数据库管理员身份执行一次。迁移在事务中完成；发生错误时应排查原因，不能随意删掉报错的权限规则。
3. 在 Authentication 的登录方式设置中启用 Anonymous Sign-ins。浏览器获得匿名会话后使用 `authenticated` 数据库角色；`anon` 角色代表没有会话的访问者，两者不同。
4. 确认 Storage 中存在公开的 `food-images` 桶，大小限制为 5 MiB（5,242,880 字节），允许 `image/jpeg`、`image/png`、`image/webp`。迁移已经创建这些配置，无需另建第二个桶。
5. 保持 Data API 的公开 schema 为 `public`；**不要将 `campus_private` 加入 Exposed schemas**。它包含发布事务的受限实现。
6. 前端配置项目 URL 和 publishable key，使用工程根目录的 `.env.example`。不要给浏览器配置 `service_role` 或其他私密密钥。
7. 完成下文的真实服务验收后，才能确认多人共享功能可用。

迁移要求 PostgreSQL 15 或更新版本。它不是重复执行脚本：成功后用后续迁移记录结构改动，不要再次运行这份初始化文件。普通页面访问者无需执行任何 SQL。

## 数据及接口约定

`foods` 保存 `id`、`name`、`location`、`area`、`category`、`price`、`image_url`、`description`、`tags`、`created_by`、`created_at`。

`ratings` 保存 `id`、`food_id`、`user_id`、`rating`、`created_at`。同一 `(food_id, user_id)` 只允许一条记录。评分必须为 1–5 的整数。管理员删除菜品后，对应评分随外键级联删除；普通用户没有此权限。

`food_summaries` 返回全部菜品字段，并附加数据库计算的 `average_rating` 和整数 `rating_count`。平均分保留一位小数；没有评分时平均分为 `null`、人数为 `0`。页面不要把示例分数复制进真实数据。

| 字段 | 数据库限制 |
| --- | --- |
| `name` | 去除首尾空白后 1–80 字符 |
| `location` | 去除首尾空白后 1–120 字符 |
| `area` | `campus` 或 `off_campus` |
| `category` | 最多 30 字符；发布时未填写则为“其他” |
| `price` | 可为空；0–99999.99，最多两位小数，不自动四舍五入 |
| `description` | 可不填写；最多 200 字符 |
| `tags` | 最多 5 个；每个 1–12 字符，不能是空白或 `null` |
| 图片 | 每条菜品只有一个 URL，必须指向本用户已上传的对象 |

发布必须调用 `public.create_food_with_rating`，参数名如下，返回新菜品 UUID：

```text
p_name text
p_location text
p_area text
p_category text
p_price numeric
p_image_url text
p_description text
p_tags text[]
p_rating integer
```

未填写的可选文本及图片传 `null`，标签传 `[]`。传入有效匿名会话后，数据库自己设置发布者身份，并在一个事务中创建菜品和首次评分。首次评分失败时，菜品也不会保留。前端不能直接向 `foods` 插入数据。

对已有菜品评分时，向 `ratings` 新增 `{ food_id, user_id, rating }`；`user_id` 必须是当前匿名用户。也可省略 `user_id`，由数据库默认设置。不要提交 `id` 或 `created_at`，这些字段由数据库生成。重复评分返回唯一约束错误 `23505`；页面应明确提示已经评分。

所有访问者都能读取菜品、评分和统计。普通用户没有修改或删除菜品/评分的权限，不能替别人评分，也不能绕过发布事务创建零评分卡片。公开读到的身份字段是匿名 UUID，不是姓名或邮箱。

## 图片上传约定

先建立匿名会话，再通过 Storage API 上传，路径固定为：

```text
当前用户 UUID/随机文件 UUID.jpg
```

扩展名也可用小写 `jpeg`、`png`、`webp`。必须使用随机 UUID 文件名，并设置 `upsert: false`。不要使用原始文件名、额外目录、查询参数或修改图片后缀来绕过类型检查。

上传成功后，用 `storage.from('food-images').getPublicUrl(path)` 获取公开 URL，作为 `p_image_url` 提交。RPC 通过已验证会话的 JWT `iss` 推出本项目地址，再检查完整 URL、用户目录、对象是否存在和对象的 `owner_id`。其他项目、外部网址、其他用户的图片及不存在的对象都会被拒绝。

V1 使用默认的 `https://项目编号.supabase.co` 项目地址。自定义域名、自托管环境、第三方认证签发者及图片转换链接尚未支持，不能只放宽 URL 检查来适配它们。

公开桶的图片可通过 URL 读取；没有给普通用户授予列出文件、替换、移动或删除对象的策略。图片先上传、再保存菜品，如果后一步失败，可能留下未被引用的图片。由管理员在 Storage 页面清理；不要直接删除 `storage.objects` 的数据库记录，否则可能留下实际文件。

## 验证方式与实际限制

在工程根目录运行本地检查：

```powershell
npm install
npm run test:db
```

2026-10-07 已运行通过：33 条断言全部通过，回滚后没有菜品、评分或用户测试记录残留。

检查运行在内存 PostgreSQL 中，覆盖数据库语法、权限、身份冒用、重复评分、字段约束、无效图片 URL、评分统计和事务回滚。它使用模拟 Auth / Storage 基础表，**不能验证 Supabase 的 HTTP 鉴权、Storage 上传流程或真实网络**。

有独立测试 Supabase 项目后，可以在 SQL Editor 中完整执行 `tests.sql`。它需要管理员身份并最终 `ROLLBACK`，不会保存虚拟用户或菜品。不要拆开执行或把最后的回滚改成提交。测试过程中会短暂加入一个故意失败的评分触发器，因此仅在没有其他人使用的测试项目中运行。

真实服务仍需检查：

1. 两个浏览器分别自动获得匿名会话；刷新后各自身份保持。
2. A 发布并上传 JPG / PNG / WebP；B 搜索到同一菜品与图片。
3. B 评分后平均分及人数变化；B 再次评分被数据库拒绝。
4. 改写请求中的用户 ID、直接写入 `foods`、修改或删除评分均被拒绝。
5. 上传到他人目录、超过 5 MiB、错误 MIME 类型、覆盖现有图片均失败；正常图片上传及完整发布成功。
6. 断网或请求失败时页面有明确反馈，重启后真实数据仍存在。

匿名身份仅限制同一匿名会话；清除浏览器数据或换设备可以产生新身份。此版本没有防刷分系统。已产生菜品或评分的匿名用户受外键保护，不应随意在后台删除 Auth 用户；需要清理时由项目管理员明确处理对应业务记录。

## 官方依据

- [数据库函数与权限](https://supabase.com/docs/guides/database/functions)
- [RLS、匿名身份及视图权限](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [JWT issuer 字段](https://supabase.com/docs/guides/auth/jwt-fields)
- [Storage 对象所有权](https://supabase.com/docs/guides/storage/security/ownership)
- [Storage 访问控制](https://supabase.com/docs/guides/storage/security/access-control)
- [存储桶配置](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Storage 数据表应如何使用](https://supabase.com/docs/guides/storage/schema/design)
- [PGlite 本地内存数据库](https://pglite.dev/docs/)
