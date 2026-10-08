import { Star } from 'lucide-react'
import './star-rating.css'

type StarRatingProps = {
  id: string
  value: number
  onChange: (value: number) => void
  label?: string
  disabled?: boolean
  required?: boolean
  error?: string
}

export function StarRating({ id, value, onChange, label = '你的评分', disabled = false, required = false, error }: StarRatingProps) {
  return (
    <fieldset className={`star-rating${error ? ' star-rating-invalid' : ''}`} disabled={disabled}>
      <legend id={`${id}-label`}>{label}{required && <span className="star-rating-required">必填</span>}</legend>
      <div className="star-rating-row">
        <div className="star-rating-options" role="radiogroup" aria-labelledby={`${id}-label`} aria-required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-hint`}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <label className={`star-rating-option${rating <= value ? ' is-filled' : ''}`} htmlFor={`${id}-${rating}`} key={rating}>
              <input id={`${id}-${rating}`} type="radio" name={id} value={rating} checked={value === rating} tabIndex={value === rating || (!value && rating === 1) ? 0 : -1} aria-label={`${rating} 星`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-hint`} onChange={() => onChange(rating)} />
              <Star size={28} fill={rating <= value ? 'currentColor' : 'none'} aria-hidden="true" />
            </label>
          ))}
        </div>
        <span className="star-rating-value" aria-live="polite">{value ? `${value} 星` : '尚未评分'}</span>
      </div>
      <p className="star-rating-hint" id={`${id}-hint`}>选择星级，也可以用键盘方向键调整。</p>
      {error && <p className="star-rating-error" id={`${id}-error`}>{error}</p>}
    </fieldset>
  )
}

export default StarRating
