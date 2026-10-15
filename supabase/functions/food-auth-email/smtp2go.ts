import type { EmailTransport } from './handler.ts'
export type Smtp2goOptions = { apiKey: string; sender: string }
const campusAddress = (email: string) => email.length <= 254 && /^[^\s@<>,;]+@zju\.edu\.cn$/.test(email)
// Fixed HTTPS origin. The verified sender is server configuration; recipients are Auth-verified payloads.
export function smtp2goTransport(options: Smtp2goOptions, request: typeof fetch = fetch): EmailTransport {
  if (!options.apiKey || /[\r\n]/.test(options.apiKey) || !campusAddress(options.sender)) throw new Error('SMTP2GO_CONFIG')
  const active = new Set<AbortController>()
  let closed = false
  return {
    async sendMail(mail) {
      if (closed) throw new Error('SMTP2GO_CLOSED')
      if (!campusAddress(mail.to) || mail.from.address !== options.sender) throw new Error('SMTP2GO_RECIPIENT')
      const controller = new AbortController(); active.add(controller)
      try {
        const response = await request('https://api.smtp2go.com/v3/email/send', {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'X-Smtp2go-Api-Key': options.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: mail.from.name + ' <' + options.sender + '>', to: [mail.to], subject: mail.subject, text_body: mail.text }),
        })
        if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 429 ? 'SMTP2GO_RATE_LIMIT' : response.status >= 500 ? 'SMTP2GO_UNAVAILABLE' : 'SMTP2GO_REJECTED') }
        const result = await response.json()
        const data = result?.data
        if (!data || data.succeeded !== 1 || data.failed !== 0 || data.error || data.error_code || !Array.isArray(data.failures) || data.failures.length || typeof data.email_id !== 'string' || !data.email_id.trim()) throw new Error('SMTP2GO_RESPONSE')
        return { accepted: [mail.to], rejected: [] }
      } finally { active.delete(controller) }
    },
    close() { closed = true; for (const controller of active) controller.abort(); active.clear() },
  }
}
