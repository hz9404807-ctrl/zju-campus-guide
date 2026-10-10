import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { copyText } from '../lib/copyText'

export default function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState('')
  const request = useRef(0)
  useEffect(() => {
    setStatus('')
    request.current += 1
    return () => { request.current += 1 }
  }, [text])
  async function copy() {
    const id = ++request.current
    setStatus('正在复制…')
    try {
      await copyText(text, navigator.clipboard?.writeText?.bind(navigator.clipboard))
      if (id === request.current) setStatus('已复制')
    } catch {
      if (id === request.current) setStatus('未能自动复制，请选中下方文字手动复制。')
    }
  }
  return <div className="guide-copy-control"><button type="button" className="guide-action-button" onClick={copy}><Copy size={15} aria-hidden="true" />{label}</button>{status && <p role="status" aria-live="polite">{status}</p>}{status.startsWith('未能') && <p className="guide-copy-fallback">{text}</p>}</div>
}
