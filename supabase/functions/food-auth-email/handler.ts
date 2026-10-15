export type EmailMail = { from: { name: string; address: string }; to: string; subject: string; text: string }
export type EmailTransport = { sendMail(mail: EmailMail): Promise<{ accepted?: unknown[]; rejected?: unknown[] }>; close(): void }
type Dependencies = {
  env(name: string): string | undefined
  verify(body: string, headers: Record<string, string>, secret: string): unknown
  transport(options: ReturnType<typeof smtpOptions>): EmailTransport
  httpTransport?(options: { apiKey: string; sender: string }): EmailTransport
  log?(event: { stage: string; code: string }): void
}
type Payload = { user?: { email?: unknown; new_email?: unknown }; email_data?: Record<string, unknown> }
const notices: Record<string, string> = {
  password_changed_notification: '密码已变更', email_changed_notification: '登录邮箱已变更',
  phone_changed_notification: '登录手机号已变更', identity_linked_notification: '登录身份已绑定',
  identity_unlinked_notification: '登录身份已解除绑定', mfa_factor_enrolled_notification: '已添加多重验证方式',
  mfa_factor_unenrolled_notification: '已移除多重验证方式',
}
function address(value: unknown) {
  if (typeof value !== 'string') throw new Error('INVALID_PAYLOAD')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@<>,;]+@zju\.edu\.cn$/.test(email)) throw new Error('INVALID_PAYLOAD')
  return email
}
function code(value: unknown) {
  if (typeof value !== 'string' || !/^\d{6,10}$/.test(value)) throw new Error('INVALID_PAYLOAD')
  return value
}
export type EmailSmtpOptions = ReturnType<typeof smtpOptions>
export function smtpOptions(user: string, password: string) {
  return {
    host: 'smtp.zju.edu.cn', port: 994, secure: true, pool: false,
    auth: { user: address(user), pass: password },
    tls: { servername: 'smtp.zju.edu.cn', rejectUnauthorized: true, minVersion: 'TLSv1.2' as const },
    connectionTimeout: 2500, greetingTimeout: 1500, socketTimeout: 3500,
    logger: false, debug: false,
  }
}
export function mailTargets(payload: Payload): { to: string; token?: string; notice?: string }[] {
  const user = payload.user
  const data = payload.email_data
  if (!user || !data || typeof data.email_action_type !== 'string') throw new Error('INVALID_PAYLOAD')
  const action = data.email_action_type
  if (action === 'email_change') {
    const next = address(user.new_email)
    // Auth's secure email-change payload uses token for current email, token_new for new email.
    if (data.token_hash_new) return [
      { to: address(user.email), token: code(data.token) },
      { to: next, token: code(data.token_new) },
    ]
    // Anonymous binding has no current email and only token (see Auth internal/api/mail.go).
    return [{ to: next, token: code(data.token_new || data.token) }]
  }
  if (notices[action]) return [{ to: address(user.email), notice: notices[action] }]
  if (!['signup', 'magiclink', 'email', 'reauthentication'].includes(action)) throw new Error('UNSUPPORTED_ACTION')
  return [{ to: address(user.email), token: code(data.token) }]
}
function errorResponse(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status, headers: { 'Cache-Control': 'no-store' } })
}
export function createEmailHandler(deps: Dependencies, deadlineMs = 4000) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return errorResponse(405, 'Method not allowed')
    const hookSecret = deps.env('FOOD_EMAIL_HOOK_SECRET')
    const provider = deps.env('FOOD_EMAIL_PROVIDER') || 'smtp'
    const https = provider === 'smtp2go'
    const sender = https ? deps.env('FOOD_EMAIL_FROM') : deps.env('FOOD_SMTP_USER')
    const password = https ? deps.env('FOOD_SMTP2GO_API_KEY') : deps.env('FOOD_SMTP_PASSWORD')
    if (!['smtp', 'smtp2go'].includes(provider) || !hookSecret || !sender || !password) return errorResponse(503, 'Email sender is not configured')
    const reader = request.body?.getReader()
    if (!reader) return errorResponse(400, 'Missing payload')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.length
        if (size > 65536) { await reader.cancel(); return errorResponse(413, 'Payload too large') }
        chunks.push(part.value)
      }
    } catch { return errorResponse(400, 'Unreadable payload') }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const body = new TextDecoder().decode(bytes)
    let payload: unknown
    try {
      // Standard Webhooks validates HMAC, webhook-id and timestamp before any SMTP operation.
      payload = deps.verify(body, Object.fromEntries(request.headers), hookSecret.replace(/^v1,whsec_/, ''))
    } catch { return errorResponse(401, 'Invalid webhook signature') }
    let targets: ReturnType<typeof mailTargets>
    try { targets = mailTargets(payload as Payload); address(sender) }
    catch { return errorResponse(400, 'Unsupported email action or invalid payload') }
    let transport: EmailTransport
    try {
      if (https) {
        if (!deps.httpTransport) throw new Error('SMTP2GO_CONFIG')
        transport = deps.httpTransport({ apiKey: password, sender })
      } else transport = deps.transport(smtpOptions(sender, password))
    }
    catch { return errorResponse(503, 'Email sender is not configured') }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      // Wait for SMTP acceptance. Never acknowledge a background task as successful delivery.
      const sending = Promise.all(targets.map(async ({ to, token, notice }) => {
        const result = await transport.sendMail({
          from: { name: '浙大校园指南课程项目', address: sender }, to,
          subject: token ? '浙大校园指南邮箱验证码' : '浙大校园指南账号安全通知',
          text: token ? `你的验证码：${token}\n请回到刚才的校园指南网页，输入邮件中的完整验证码完成验证。\n如果不是你本人操作，请忽略此邮件。请勿向他人提供验证码。\n本服务为课程项目，非学校官方平台。`
            : `${notice}。如果不是你本人操作，请检查登录账号并联系项目维护者。\n本服务为课程项目，非学校官方平台。`,
        })
        if (!result.accepted?.some((value) => typeof value === 'string' && value.toLowerCase() === to) || result.rejected?.length) throw new Error('SMTP_REJECTED')
      }))
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { transport.close(); reject(new Error(https ? 'EMAIL_HTTP_TIMEOUT' : 'SMTP_TIMEOUT')) }, deadlineMs)
      })
      await Promise.race([sending, timeout])
      deps.log?.({ stage: https ? 'smtp2go' : 'smtp', code: 'ACCEPTED' })
      return Response.json({}, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const rawCode = error instanceof Error ? ('code' in error ? String(error.code) : error.message) : ''
      const safeCode = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'SMTP_TIMEOUT', 'SMTP_REJECTED', 'EMAIL_HTTP_TIMEOUT', 'SMTP2GO_RATE_LIMIT', 'SMTP2GO_UNAVAILABLE', 'SMTP2GO_REJECTED', 'SMTP2GO_RESPONSE'].includes(rawCode) ? rawCode : 'SMTP_ERROR'
      deps.log?.({ stage: https ? 'smtp2go' : 'smtp', code: safeCode })
      return errorResponse(503, 'Email sender failed; please retry later')
    } finally { clearTimeout(timer); transport.close() }
  }
}
