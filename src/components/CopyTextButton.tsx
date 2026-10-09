import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'

export default function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState('')
  useEffect(() => { setStatus('') }, [text])
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setStatus('已复制')
    } catch {
      setStatus('未能复制，请选中文字手动复制。')
    }
  }
  return <div className="guide-copy-control"><button type="button" className="guide-action-button" onClick={copy}><Copy size={15} aria-hidden="true" />{label}</button>{status && <p role="status" aria-live="polite">{status}</p>}</div>
}
