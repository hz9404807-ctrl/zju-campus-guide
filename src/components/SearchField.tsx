import { useRef } from 'react'
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

  return (
    <div className="search-field">
      <label className="search-field-label" htmlFor={id}>{label}</label>
      <div className="search-control">
        <Search className="search-control-icon" size={21} aria-hidden="true" />
        <input
          ref={input}
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <button
            className="search-clear"
            type="button"
            aria-label="清空搜索"
            onClick={() => {
              onChange('')
              input.current?.focus()
            }}
          ><X size={18} aria-hidden="true" /></button>
        )}
      </div>
      {hint && <p className="search-field-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  )
}
