## 2026-10-19 个人中心及邮箱写入限制

原项目已应用 `202610170001_personal_center_ratings.sql` 与 `202610180001_food_verified_writes.sql`。前者开放按当前账号查询评分历史，后者使 `require_email=true` 并在评分 INSERT 策略中验证真实校园邮箱。旧菜品、评分、公开读取、SMTP 均保留；五档案尚未开通。

新环境按 initial → food_email_management → personal_center_ratings → food_verified_writes 部署；不要在已有项目重跑旧迁移。验收可使用 `verify-personal-center.sql`，仅检查权限和现有数据，无写入测试数据。下方为历次配置记录，较早的“本轮未执行”不代表当前状态。

# Supabase 数据库与图片配置

## 当前路线：QQ邮箱原生SMTP465（2026-10-15，云端认证535待解决）

最新实测：配置已保存，云端Auth请求约3.4秒返回500；同一request_id日志确认QQ 535 Login fail。后台Host/Port/Username/From四项已逐项核对。可能是服务未开启、授权码与账号不符或QQ风控等，不能仅凭535断言密码错误。用户开启服务后，必须将新生成的授权码覆盖Supabase Password并再次Save changes；仅开启开关不会更新旧密码。未完成真实投递验收前保持邮箱READY=false，不自动重试刷请求。

用户实测SMTP2GO注册返回Error code 6 - Service unavailable；不能以官方免费规则推定账号可用，也未证明此错误由地区或学校域名引起。用户选择使用已有QQ邮箱作为项目发件人。学生登录和收件邮箱继续精确限定@zju.edu.cn，五档案实现保持不变。

本机未认证TLS探测smtp.qq.com:465成功：证书验证通过、TLS1.3约176ms，SMTP220问候约231ms；这不是云端SMTP认证或投递证明。使用Supabase原生Custom SMTP，保持Send Email Hook Disabled，不依赖未开通的SMTP2GO或Resend、不购域名。参数：Host=smtp.qq.com；Port=465；Sender email address和Username均为用户指定QQ邮箱；Sender name=浙大校园指南课程项目；Minimum interval per user=60。Password仅填QQ邮箱生成的SMTP授权码，不是QQ登录密码或学校专用密码，不进源码、聊天、日志或Git。

维护者本人在QQ邮箱设置中开启第三方SMTP并生成授权码，最终只在Supabase后台Password栏输入、保存。保存代表Supabase获得该QQ邮箱的SMTP发信能力。先以一次Auth原生OTP实测服务端返回及学校邮箱真实收件；通过后再开启本地入口、完成第二个学生邮箱收件及五档案云端迁移验收。此前271项代码测试和85项数据库断言不能代替这些真实检查。当前入口READY仍false，未开通。QQ个人邮箱存在风控/频率限制，不宣称免费无限量或适合大规模商业群发。

官方配置依据：[腾讯Email连接器/授权码](https://cloud.tencent.com/document/product/1270/55456)、[腾讯邮箱登录SMTP配置](https://intl.cloud.tencent.com/zh/document/product/1266/71700)、[Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。以下保留此前方案调查记录，非当前已开通配置。


## 2026-10-13 浙大邮箱登录与作者管理：配置及开通步骤

2026-10-13用户进一步授权彻底开通。Custom SMTP已保存（学校服务器25 STARTTLS候选路径），Confirm sign up、Magic link or OTP、Change email address三类验证码邮件模板已保存；作者管理迁移已在用户审阅警告并确认后应用。5道菜/7条评分原字段逐项保留，时间按微秒精度一致，未登录管理接口401/42501拒绝访问。Allow manual linking经用户确认后已保存。真实邮件送达、账号绑定和完整作者管理仍待验收；用户选择亲自快速注册验收，本地READY已开启供试点，尚不宣称正式开通。

### 1. 准备发信服务

准备项目专用发信地址、SMTP主机、端口、用户名、SMTP密码/授权码；有自有域名的服务按供应商完成发信域名验证及DNS设置。发件人不必是浙大邮箱。密钥只填Supabase后台或服务端秘密配置，不放VITE变量、源代码或Git。默认Supabase邮件服务仅向项目团队地址发信，不适合面向同学开放；不通过把所有同学加入管理团队来绕过。

本次已选学校邮箱作小范围发件试点。官方主机`smtp.zju.edu.cn`，SSL端口994；官方也支持客户端专用密码。2026-10-13本机无认证连接检查通过：994直接TLS与25 STARTTLS均协商TLS1.3并校验证书。没有执行SMTP认证、发送或证明Supabase端可连接。

Supabase公开Auth邮件实现使用gomail.NewDialer；该库默认仅端口465启用直接SSL，因此**不要把994照填到默认Custom SMTP并宣称已兼容**。候选为25 STARTTLS，后台也提醒25可能被服务商屏蔽；需在实际Auth发送及日志中验证。不允许为了连接而关闭TLS/证书验证。若该路径不通，改用兼容465/587的独立发信服务，或单独评估使用加密994的邮件Hook，不能只切前端READY。

发件名称用“浙大校园指南课程项目”，发件地址/用户名由持有人填入；Password填独立专用密码，不能填浙大通行证密码。专用密码由持有人在官方邮箱生成；本次经过明确授权后在Supabase页面代为保存。不要在聊天、文档或源代码中记录凭据。个人邮箱只用于小范围试点，扩展到同学前先确认发送限制与持续维护方式。

依据：[学校邮箱参数](https://itc.zju.edu.cn/90691/list.htm)、[客户端专用密码](https://imap.zju.edu.cn/coremail/help/2fa_zh_CN.html)、[Supabase邮件实现](https://github.com/supabase/auth/blob/master/internal/mailer/mailmeclient/mailmeclient.go)、[gomail端口及STARTTLS实现](https://github.com/go-gomail/gomail/blob/master/smtp.go)。

### 本机单次发信检查（Nodemailer，2026-10-15）

当前工具：`node supabase/tools/smtp-diagnostic.mjs`，无需Python参数。由用户本人在输出的127.0.0.1页面输入现有QQ授权码，接受分组空格，认证成功后才发送一封测试邮件。固定smtp.qq.com:465、AUTH LOGIN、TLS证书校验；固定发件zhx20070808@qq.com、收件3250103966@zju.edu.cn，不能通过前端改变收发地址。

实现使用固定版本Nodemailer。每次临时服务仅允许一次有效检查，不自动换认证方式或重试；输入格式错误不占次数。实际发信在隔离子进程中运行，内部期限30秒、外部31秒兜底终止进程；超时中断连接并将投递状态标为未知，禁止自动重复发送。连接/认证/发送错误只显示安全分类和SMTP状态码，不暴露服务器原文或凭据。SMTP接受不等于收件箱收到，更不等于网站登录开通。

服务仅loopback，Host、Origin、随机nonce、CSP和no-store保护；20分钟后关闭。授权码仅在本机进程内临时使用，不记录日志、文件、进程参数或环境变量，不修改Supabase。旧Python工具保留为历史诊断，不再作为当前入口。离线模拟服务器验证535前不发送MAIL、成功仅发一封固定收件邮件、并发单次限制和超时关闭；不是实际QQ成功证据。

真实历史：PLAIN本机与Supabase均535；旧LOGIN诊断发生CHECK_FAILED；2026-10-15成熟Nodemailer执行一次AUTH LOGIN，真实返回EAUTH/535，停止且未进入发送。接下来只有本机真实发信成功且用户确认收件后才测Supabase OTP；535则停止程序重试并定位QQ认证，不能要求反复保存授权码，也不关闭邮箱确认冒充可用。

依据：[Nodemailer SMTP官方文档](https://nodemailer.com/smtp)。

用户确认已有个人Gmail，可评估直接使用Supabase原生Custom SMTP：smtp.gmail.com:465、SSL、完整Gmail用户名和相同From、Google应用专用密码。先由持有人开启两步验证并确认应用专用密码可用；不使用普通Google密码、不要求学生拥有Google账号、不买域名或Workspace。实际Supabase发信和浙大邮箱收件尚未验证，不保证跨境投递或长期批量可用。个人Gmail官方日发送上限不是验证码送达SLA；以低频课程试点验收。依据：[Google应用专用密码](https://support.google.com/accounts/answer/185833?hl=zh-Hans)、[Gmail发送限制](https://support.google.com/mail/answer/22839?hl=zh-Hans)、[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。

### 零付费多人邮箱登录候选（SMTP2GO HTTPS，待云端验收）

2026-10-15目标：所有持有浙大邮箱的同学均可验证登录；每个已验证Auth用户最多五个发布档案，各自管理发布，评分仍按邮箱用户限制。五档案不是五个不同邮箱Auth账号，沿用用户先前明确选择的方案。

调研以官方资料为准：

| 路线 | 是否买域名 | 多人收件 | 当前结论 |
| --- | --- | --- | --- |
| Supabase默认邮件 | 无需 | 仅项目团队授权邮箱 | 不符合学生自主注册目标 |
| Resend测试域名 | 无需 | 仅Resend账号自身邮箱 | 已撤换未提交的单人适配，不能作为正式目标 |
| 浙大SMTP994 | 无需 | 理论支持 | 云端实测SMTP_TIMEOUT，保留旧源码回退但不继续盲目重试 |
| SMTP2GO Free 单邮箱发件人+HTTPS | 无需 | 支持不同收件邮箱 | 新候选，必须完成真实账号及投递验收 |

免费边界：1,000封/月、200封/天、未验证域名时25封/小时；无免费试用到期，但免费额度不是无限量，达到额度可能排队或拒绝。排队可能使验证码过期；不自动购买额度或升级。单发件邮箱无需管理学校DNS，但服务商规定若发件域名存在限制性DMARC策略，则不能用单邮箱验证。一次本机DNS查询未发现学校DMARC记录不能保证服务商审核通过。必须以后台实际Verified状态为准。

部署步骤：

1. 维护者在SMTP2GO创建Free账号并完成账号验证；同学只登录我们的网页，不注册SMTP2GO。Sending → Verified Senders → Single sender emails 添加维护者发信邮箱，由邮箱本人点击确认链接。不付费、不改学校DNS。
2. Sending → API Keys 创建仅允许 email/send 的密钥，设置不高于25封/小时的限制，禁用Open/Click Tracking、BCC审计及Sandbox。密钥只保存到Supabase Edge Secret，不发送聊天、不进入VITE/Git。
3. 保持邮箱Hook Disabled。部署同一 food-auth-email 的 index.ts、handler.ts、smtp2go.ts；配置 FOOD_EMAIL_PROVIDER=smtp2go、FOOD_EMAIL_FROM=已验证浙大邮箱、FOOD_SMTP2GO_API_KEY=服务端密钥，保留既有FOOD_EMAIL_HOOK_SECRET。该方案不需要学校邮箱专用密码。
4. 保留函数内HMAC签名校验和该函数现有JWT设置。验证无签名请求401，再经Auth发送到两个不同的真实浙大邮箱；签名载荷中的收件人不能被前端任意指定。必须实际收到验证码、输入8位验证码成功，不能把模拟测试或HTTP200当收件成功。
5. 五档案 migration 202610130002_food_profiles.sql 已有本地数据库测试，尚未执行云端。上线前检查数据库现状、保留现有食品/评分、执行该迁移，核对API与跨用户隔离，再打开VITE_FOOD_PROFILES_READY。验证第六档案被后端拒绝、切换各自发布、另一邮箱看不到私有档案；最后开启邮箱入口。
6. 若请求失败：先禁用Hook、关闭本地/部署邮箱READY，保留真实数据。不要删除用户、清空内容或自动回退到已知超时SMTP。HTTPS适配没有自建验证码，继续由Supabase生成并验证OTP，支持匿名绑定与安全双邮箱确认。

HTTP适配固定请求 https://api.smtp2go.com/v3/email/send；仅在succeeded=1、failed=0、failures为空且存在email_id时认为服务商已接受。HTTP200错误体、限额、部分失败、异常及超时都返回失败。总截止4秒并取消HTTP请求；不异步伪报成功，不启用fastaccept，不捏造服务商幂等保证。服务商接受不保证收件箱送达。

权威依据：[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)、[SMTP2GO Free](https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan)、[Verified Senders及DMARC例外](https://support.smtp2go.com/hc/en-gb/articles/115004408567-Verified-Senders)、[API设置](https://developers.smtp2go.com/docs/getting-started)、[发送请求与响应](https://developers.smtp2go.com/docs/send-an-email)、[Resend测试限制](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)。价格与规则核对日期2026-10-15。

### 994发信Hook候选（已部署，真实投递未通过验收）

用户确认收件箱及垃圾邮件无验证码。Auth日志里的504/request_timeout与随后200属于同一request_id；504历时10.0036秒，200历时10.0270秒，不能解读成另一次成功投递。当前25路径未证实送达，真正阻塞环节尚需云端探测，前端增大等待时间不能解决该服务端超时。

候选源码是 functions/food-auth-email/index.ts 及 handler.ts，专门服务校园指南邮箱OTP。使用npm官方注册表核实并锁定nodemailer 10.1.0与standardwebhooks 1.1.1。明示994直接TLS、校验证书和TLSv1.2以上；底层SMTPConnection可取消正在发送的连接，4秒截止，在HTTP Hook的5秒限制前返回。只在所有收件地址获SMTP接受后返回200；这仍不等于收件箱送达，不异步排队伪报成功。

先校验Standard Webhooks的HMAC/时间戳再发信，限制64KiB正文、精确学校邮箱、6至10位Auth原生Token；日志仅含阶段与预设结果码，不写邮箱、验证码、密码或原始异常。匿名绑定发唯一Token到new_email；双确认变更按Auth约定把token发旧邮箱、token_new发新邮箱，不降低安全邮箱变更要求。现有signup/magiclink/email/reauthentication及账号安全通知支持；当前原型无密码找回和邀请入口，recovery/invite明确返回失败。若未来启用这些流程，必须先扩展对应模板/验证入口并测试；Hook替代项目全部Auth邮件而非只影响当前页面。

云端切换审阅范围：

1. 部署这两个源码文件组成的 food-auth-email Edge Function，继续保留数据库权限、邮箱确认及既有用户数据。
2. 新增Edge服务端Secret：FOOD_SMTP_USER、FOOD_SMTP_PASSWORD（复用已授权学校客户端专用密码）及FOOD_EMAIL_HOOK_SECRET（由后台生成/配置）。Secret由Supabase保管，属于项目Edge运行环境，不进入VITE/Git/明文文件；Auth后台签名配置保持DISABLED。2026-10-14已在授权表单逐项保存三项Edge Secret，Custom secrets表确认三个名称存在；凭据值不在本地文件/仓库中。
3. 仅该函数关闭平台用户JWT检查，因为Auth调用携带的是Webhook签名；函数内部签名校验继续开启。先确认无签名请求401、无发信，之后配置Auth的Send Email Hook。不可设置一个无签名的公共邮件接口。
4. 先验证云端实际连通及SMTP认证、日志没有凭据，再让用户本地发送一次注册/绑定OTP、亲自收信并验证。若云端连接或5秒期限不适合，停止切换，保留错误证据，改选兼容的发信服务，不降低TLS或邮箱验证保护。

回退：关闭Send Email Hook即可恢复原Custom SMTP配置；该旧路径本轮也未完成送达验收，回退并不等于邮箱恢复可用。失败时关闭本地READY、重新构建，暂时保留已验证账号的管理入口。先禁用Hook，再撤下候选函数/移除不再使用的Edge Secret；不可在Hook启用时先删除依赖。没有执行数据清空、账号合并、密码重置或新的SQL迁移。

2026-10-14最新实测：food-auth-email已部署并通过无签名POST的401拒绝检查；后台实际OTP为8位，已修复前后端旧6位限制并重新部署。真实Auth请求进入SMTP后返回服务不可用，日志SMTP_TIMEOUT；邮箱尚未开通，不能把部署成功当送达成功。本地READY关闭，Hook已回退并核实Disabled。以下为此前部署记录。

部署进展：用户已明确确认部署/Edge保存现有专用密码/签名鉴权切换及实测。Auth Hook已保存为HTTPS且DISABLED，函数源码与名称已在编辑器准备。自动审批曾超时约7分钟；随后工具提交仍无成功或错误反馈，函数公开地址404，后台反复出现认证锁警告。尚未证明警告就是部署失败根因，已请用户手动提交确认。2026-10-14三项Edge Secret已逐项保存并按名称验证，保存后正常刷新/部署仍未出现成功；未启用Hook或宣称投递成功。剪贴板及密钥页截图方式因风险被自动审批拒绝，未绕过；改用直接表单及脱敏名称/状态验证，临时签名值已清除。

已完成：纯逻辑与前端Auth回归、真实库有效/篡改/缺失/过期签名检查、UTF-8 MIME、本机无认证TLS+EHLO、类型检查；真实SMTP认证、云端Deno运行和邮件投递尚未完成。学校994路径在本机约146ms完成TLS+EHLO，不能当作云端结果。

依据：[学校邮箱参数](https://itc.zju.edu.cn/90691/list.htm)、[Nodemailer SMTPConnection](https://nodemailer.com/extras/smtp-connection)、[Send Email Hook及邮箱变更映射](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)、[Hook错误与超时](https://supabase.com/docs/guides/auth/auth-hooks/hook-errors)、[Edge网络限制](https://supabase.com/docs/guides/functions/limits)。Edge限制25/587不代表Auth SMTP本身必然同样被限制，本轮不作该推断。

### 五个独立发布档案（本地实现，云端未迁移）

2026-10-14按用户选择，实现一个已验证邮箱下默认档案加四个自定义档案，合计最多五个。只有一个真实Auth账号；每个档案独立发布及管理，评分仍以该Auth用户ID计算，不可通过档案重复评分。

迁移为 migrations/202610130002_food_profiles.sql。它添加拥有者/名称/槽位/最多5个约束的food_profiles，foods追加profile_id及复合拥有者外键，统计视图末尾追加字段。默认档案在首次读取时为当前已验证账号初始化，把本人旧发布及旧版接口产生的记录分配到默认档案；不修改作者、创建/更新时间、评分或他人旧发布。锁定同一auth.users行串行初始化与创建，并以唯一槽位及范围约束限制容量。

普通客户端只能读取本人档案，不能直接新增、修改、删除档案。创建、编辑、撤下/恢复接口验证真实邮箱身份和档案归属；创建还校验预期登录ID，避免进行中换账号时写入另一邮箱；将原编辑实现移到campus_private后显式撤销普通角色调用权限，公共旧接口仍用于默认档案及未分配旧记录，不能绕过管理其它档案。新RPC仍复用原版本冲突/图片归属校验。浏览公开菜品不要求档案，名称不对其他邮箱或访客公开。

开通顺序：

1. 先完成邮件发送、验证码绑定与既有作者管理真实验收。备份既有数据库结构/数据；review这份增量迁移，云端只执行一次，不重复initial。本轮没有执行该迁移。
2. 在本地应用后设置VITE_FOOD_PROFILES_READY=true并重构建；默认.env.example为false。验证首次加载默认档案、创建4个其它档案、拒绝第6个、重复/非法名称反馈。
3. 各档案发布测试菜品，切换后“我的发布”只显示对应记录；编辑从详情打开时自动选择该发布所属档案，编辑期间锁定切换并提供返回入口。测试撤下、恢复、原评分保留；尝试同一邮箱切换档案再次评分仍被拒绝。
4. 另一邮箱不能获取档案名称或管理发布；不允许直接表写入和私有实现调用。重登/换设备后仍取得同一组档案；本机只储存按Auth用户ID分开的选择记忆，无法把任意UUID变成有效身份。并发创建需在真实多会话环境确认，本地单会话夹具不冒称完成该项验收。

五档案尚未产生实际云端数据前，可保持开关false或revert前端功能提交，现有邮箱流程继续工作。产生其它档案发布后，不可简单回退为旧客户端再声称所有档案均可管理；先保留可读和管理的接口/前端、停止推广并修复，不能删除档案或清空发布来回退。本轮迁移只存在本地，未保存新私密凭据、创建真实邮箱/档案或更改投票规则。

### 2. 在Supabase配置认证及模板

- 在Authentication设置里配置Custom SMTP及发件人；测试发送到可收信的浙大邮箱，检查收件箱、垃圾箱、延迟、重发与供应商发送限制。
- 保持Email provider和邮箱确认开启；为了绑定现有匿名身份，开启manual linking。保留Anonymous Sign-ins供浏览和既有评分身份使用。不要关闭邮箱确认来模拟已验证账号。
- 配置Confirm sign up（首次无匿名会话注册）、Magic Link/OTP（已有账号登录）及Change Email Address（匿名身份绑定）三种邮件模板，都显示 `{{ .Token }}`。参考模板：`<h2>浙大校园指南验证码</h2><p>你的验证码：<strong>{{ .Token }}</strong></p><p>请回到刚才的网页输入验证码。如果不是你操作的，请忽略此邮件。</p>`。本前端验证6位OTP，不依赖邮件链接回调，首次匿名绑定使用email_change验证，已有账号使用email验证。
- 邮件主题建议“浙大校园指南邮箱验证码”；不宣称学校官方系统，不收取邮箱密码。更换已绑定邮箱涉及旧新邮箱确认，当前前端不提供换邮箱入口，也不关闭安全确认设置。

### 3. 应用新增数据库迁移

先备份数据库并审阅 `migrations/202610130001_food_email_management.sql`，在已初始化的项目执行一次；不要重复执行initial。新增updated_at/deleted_at、学校邮箱域名触发器和两个作者RPC；通过auth.users的真实验证状态判定身份，覆盖email与email_change（注册、绑定、变更），不信任前端作者ID或user_metadata。直接修改foods、创建者和评分的权限仍关闭；campus_private仍不得加入Exposed schemas。

新增迁移的require_email初始false，便于现有匿名版本过渡，不等于正式邮箱限制已开启。修改/删除/恢复接口始终要求已验证浙大邮箱且本人是作者。公共读取从数据库策略就排除已删除记录；验证作者可在自己的列表中管理恢复。图片更新只接受本人目录中存在的本项目对象；不用覆盖上传。

### 4. 小范围真实验收后开启

在本地 `.env.local` 设置 `VITE_FOOD_EMAIL_AUTH_READY=true` 并重新构建，仅用于完成SMTP和迁移后的真实试用。依次验证：

1. 无会话的新浏览器选择首次使用，确认注册邮件也是6位OTP；错码不得成功登录。然后在原发布浏览器选择“首次使用/绑定本浏览器的发布”，检查Auth用户ID前后相同，已有菜品及评分归属保留。
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

## 私有个人资料增量迁移（待部署）

`202610220001_campus_account_details.sql` 在已部署的 `202610130001_food_email_management.sql` 之后执行一次即可；与个人评分历史、收藏和五档案迁移无依赖。不要重复运行初始化脚本，不启用五档案、不修改 SMTP 或云端功能开关。本轮只交付迁移及本地权限测试，没有执行真实云端结构变更。

它创建 `public.campus_account_details`：`user_id` 主键关联 Auth 账号（不是发布档案），`gender` 为 `undisclosed/female/male/other`，`signature` 最多120个字符且无控制字符，`campus` 为允许的校区或空字符串，`updated_at` 为服务端版本。字段全部仅本人可见，不含邮箱或公开个人主页。表启用RLS，authenticated只有经真实Auth资格检查的本人SELECT，anon无读取权，普通客户端无直接写权限。

公开RPC契约：

- `get_my_campus_details(p_expected_user_id uuid)` 返回0或1条本人记录；0条表示尚未保存，不自动创建资料。
- `save_my_campus_details(p_expected_user_id uuid, p_gender text, p_signature text, p_campus text, p_expected_updated_at timestamptz)` 返回已保存的1条本人记录；首次写入传NULL版本，更新须携带读取到的原始版本。唯一约束与版本比较使重复创建、过期修改返回40001，参数身份不符或邮箱失去验证返回42501。

两函数均固定空search_path、撤销PUBLIC/anon权限、仅授authenticated执行，并在函数体调用已有`require_campus_member()`且按`auth.uid()`查写；预期用户ID仅用于比较，不充当所有者来源。未部署的RPC返回PGRST202/42883时前端明确提示待接入。浏览器继续使用原Supabase客户端，没有管理密钥或直接读取`auth.users`。

`npm run test:db` 已接入 `campus-account-details.tests.sql`，在邮箱-only与兼容五档案结构上各40项断言，覆盖本人读取、跨账号隔离、匿名/未验证/伪造JWT拒绝、旧会话失去资格、重复创建、并发版本、Unicode/控制字符/首尾空格长度约束及权限。测试事务回滚资料与Auth夹具。Supabase HTTP/RLS网关、真实邮箱及跨设备同步仍需部署后验收，详细点击步骤见 [个人中心说明](../docs/personal-center.md)。

## 官方依据

- [数据库函数与权限](https://supabase.com/docs/guides/database/functions)
- [RLS、匿名身份及视图权限](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [JWT issuer 字段](https://supabase.com/docs/guides/auth/jwt-fields)
- [Storage 对象所有权](https://supabase.com/docs/guides/storage/security/ownership)
- [Storage 访问控制](https://supabase.com/docs/guides/storage/security/access-control)
- [存储桶配置](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Storage 数据表应如何使用](https://supabase.com/docs/guides/storage/schema/design)
- [PGlite 本地内存数据库](https://pglite.dev/docs/)
