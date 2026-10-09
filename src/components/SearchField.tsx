import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import './search.css'

type SearchFieldProps = {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  hint?: string
}

export default function SearchField({ id, label, placeholder, value, onChange, hint }: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null)
  // Keep unfinished IME text local; URL updates can interrupt Chinese composition.
  const composing = useRef(false)
  const lastPublished = useRef(value)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!composing.current) {
      setDraft(value)
      lastPublished.current = value
    }
  }, [value])

  function publish(next: string) {
    if (next !== lastPublished.current) {
      lastPublished.current = next
      onChange(next)
    }
  }

  return (
    <div className="search-field">
      <label className="search-field-label" htmlFor={id}>{label}</label>
      <div className="search-control">
        <Search className="search-control-icon" size={21} aria-hidden="true" />
        <input
          ref={input}
          id={id}
          type="search"
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={(event) => {
            composing.current = false
            const next = event.currentTarget.value
            setDraft(next)
            publish(next)
          }}
          onChange={(event) => {
            const next = event.currentTarget.value
            setDraft(next)
            if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) publish(next)
          }}
        />
        {draft && (
          <button
            className="search-clear"
            type="button"
            aria-label="清空搜索"
            onClick={() => {
              composing.current = false
              setDraft('')
              publish('')
              input.current?.focus()
            }}
          ><X size={18} aria-hidden="true" /></button>
        )}
      </div>
      {hint && <p className="search-field-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  )
}
