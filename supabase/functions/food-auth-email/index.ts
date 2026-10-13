import SMTPConnection from 'npm:nodemailer@10.1.0/lib/smtp-connection'
import MailComposer from 'npm:nodemailer@10.1.0/lib/mail-composer'
import { Webhook } from 'npm:standardwebhooks@1.1.1'
import { createEmailHandler, type EmailTransport, type EmailMail, type EmailSmtpOptions } from './handler.ts'

function transport(options: EmailSmtpOptions): EmailTransport {
  const active = new Set<SMTPConnection>()
  return {
    async sendMail(mail: EmailMail) {
      const message = await new MailComposer(mail).compile().build()
      return await new Promise((resolve, reject) => {
        const connection = new SMTPConnection(options)
        active.add(connection)
        let completed = false
        const finish = (error?: Error | null, result?: { accepted?: string[]; rejected?: string[] }) => {
          if (completed) return
          completed = true
          active.delete(connection)
          connection.close()
          if (error) reject(error)
          else resolve(result ?? {})
        }
        connection.once('error', (error: Error) => finish(error))
        connection.once('end', () => finish(new Error('SMTP_CONNECTION_CLOSED')))
        connection.connect((error?: Error | null) => {
          if (error) { finish(error); return }
          connection.login(options.auth, (authError?: Error | null) => {
            if (authError) { finish(authError); return }
            connection.send({ from: mail.from.address, to: [mail.to] }, message, (sendError: Error | null, info: { accepted?: string[]; rejected?: string[] }) => finish(sendError, info))
          })
        })
      })
    },
    // Explicitly close active SMTP connections, including stalled sends.
    // High-level Nodemailer transport.close() alone does not cancel an active send.
    close() { for (const connection of active) connection.close(); active.clear() },
  }
}

// Only Auth's signed Standard Webhooks requests are accepted; no browser CORS or user-JWT sender.
Deno.serve(createEmailHandler({
  env: (name) => Deno.env.get(name),
  verify: (body, headers, secret) => new Webhook(secret).verify(body, headers),
  transport,
  log: (event) => console.log(JSON.stringify(event)),
}))
