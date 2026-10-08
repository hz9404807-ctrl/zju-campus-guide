# Supabase 数据库与图片配置

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
