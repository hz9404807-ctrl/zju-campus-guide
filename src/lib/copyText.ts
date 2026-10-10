// Some embedded browsers never settle clipboard requests. Always provide a visible fallback.
export async function copyText(text: string, write?: (text: string) => Promise<void>, timeoutMs = 1500) {
  if (!write) throw new Error('Clipboard unavailable')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      write(text),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Clipboard timed out')), timeoutMs) }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
