import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Info, LoaderCircle, RefreshCw, Star } from 'lucide-react'
import { FoodServiceError } from '../lib/foodApi'
import { getMyRating, isFoodBackendConfigured, rateFood } from '../lib/foodService'
import type { Food } from '../types/food'
import { StarRating } from './StarRating'
import './food-rating-panel.css'

type FoodRatingPanelProps = { food: Food; onRated: () => void }
type RatingStatus = 'checking' | 'check-error' | 'ready' | 'rated'

function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

function isAlreadyRated(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ALREADY_RATED'
}

function FoodRatingPanelContent({ food, onRated }: FoodRatingPanelProps) {
  const canRateLive = !food.isExample && isFoodBackendConfigured
  const panelId = `food-rating-${useId()}`
  const fieldId = `${panelId}-stars`
  const [status, setStatus] = useState<RatingStatus>(canRateLive ? 'checking' : 'ready')
  const [selected, setSelected] = useState(0)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [checkError, setCheckError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [readingPreviousRating, setReadingPreviousRating] = useState(false)
  const [previousRatingError, setPreviousRatingError] = useState('')
  const [checkAttempt, setCheckAttempt] = useState(0)
  const submissionLock = useRef(false)
  const ratedLock = useRef(false)
  const mounted = useRef(false)
  const feedbackElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!canRateLive) return
    let active = true
    const alreadyLocked = ratedLock.current
    if (alreadyLocked) {
      setReadingPreviousRating(true)
      setPreviousRatingError('')
    } else {
      setStatus('checking')
      setCheckError('')
    }

    getMyRating(food.id).then((rating) => {
      if (!active) return
      if (rating !== null && !isValidRating(rating)) {
        throw new FoodServiceError('LOAD_FAILED', '暂时无法获取你的评分，请重试。')
      }
      if (rating !== null) {
        ratedLock.current = true
        setMyRating(rating)
        setStatus('rated')
      } else if (alreadyLocked) {
        setPreviousRatingError('暂时无法显示你之前的星级。评分已存在，不能再次提交。')
      } else {
        setStatus('ready')
      }
    }).catch((error: unknown) => {
      if (!active) return
      if (alreadyLocked) {
        setPreviousRatingError('暂时无法显示你之前的星级。评分已存在，不能再次提交。')
      } else {
        setStatus('check-error')
        setCheckError(error instanceof FoodServiceError ? error.message : '暂时无法获取你的评分，请检查网络后重试。')
      }
    }).finally(() => {
      if (active) setReadingPreviousRating(false)
    })

    return () => { active = false }
  }, [canRateLive, food.id, checkAttempt])

  useEffect(() => {
    if (feedback) feedbackElement.current?.focus({ preventScroll: false })
  }, [feedback])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionLock.current || ratedLock.current || status !== 'ready') return
    setFeedback('')
    if (!isValidRating(selected)) {
      setRatingError('请选择 1～5 星评分后再提交。')
      document.getElementById(`${fieldId}-1`)?.focus()
      return
    }
    setRatingError('')
    if (!canRateLive) {
      setFeedback('共享服务尚未连接，这次评分没有提交。')
      return
    }

    submissionLock.current = true
    setBusy(true)
    let shouldRefresh = false
    try {
      await rateFood(food.id, selected)
      if (!mounted.current) return
      ratedLock.current = true
      setMyRating(selected)
      setStatus('rated')
      setSubmitted(true)
      shouldRefresh = true
    } catch (error: unknown) {
      if (!mounted.current) return
      if (isAlreadyRated(error)) {
        ratedLock.current = true
        setMyRating(null)
        setStatus('rated')
        setReadingPreviousRating(true)
        setCheckAttempt((current) => current + 1)
        shouldRefresh = true
      } else {
        setFeedback(error instanceof FoodServiceError ? error.message : '评分提交失败，请检查网络后重试。已选择的星级会保留。')
      }
    } finally {
      submissionLock.current = false
      if (mounted.current) setBusy(false)
    }
    if (shouldRefresh && mounted.current) onRated()
  }

  return (
    <section className="food-rating-panel food-rating-panel-interactive" aria-labelledby={`${panelId}-title`} aria-busy={busy || status === 'checking' || readingPreviousRating}>
      <div className="food-rating-panel-icon"><Star size={24} aria-hidden="true" /></div>
      <div className="food-rating-panel-body">
        <h2 id={`${panelId}-title`}>给这道菜评分</h2>
        <p className="food-rating-rule">每个匿名身份对同一道菜只能评分一次，提交后不支持修改。</p>

        {status === 'checking' && <div className="food-rating-checking" role="status"><LoaderCircle size={18} className="food-rating-spinner" aria-hidden="true" /><span>正在检查你的评分记录…</span></div>}

        {status === 'check-error' && <div className="food-rating-check-error"><p role="alert">{checkError}</p><button type="button" className="food-rating-retry" onClick={() => setCheckAttempt((current) => current + 1)}><RefreshCw size={16} aria-hidden="true" />重新检查评分</button></div>}

        {status === 'rated' && <div className="food-rating-locked">
          <div className="food-rating-locked-heading" role="status"><Check size={19} aria-hidden="true" /><strong>你已经评分过该菜品</strong></div>
          {submitted && <p className="food-rating-success" role="status">评分已提交，感谢分享。</p>}
          {myRating !== null && <div className="food-rating-saved" aria-label={`你的评分：${myRating} 星`}><span className="food-rating-saved-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={22} fill={value <= myRating ? 'currentColor' : 'none'} className={value <= myRating ? 'is-filled' : ''} />)}</span><span>你的评分：{myRating} 星</span></div>}
          {readingPreviousRating && <div className="food-rating-checking" role="status"><LoaderCircle size={17} className="food-rating-spinner" aria-hidden="true" /><span>正在读取你之前的星级…</span></div>}
          {previousRatingError && <div className="food-rating-previous-error"><p role="alert">{previousRatingError}</p><button type="button" className="food-rating-retry" onClick={() => setCheckAttempt((current) => current + 1)} disabled={readingPreviousRating}><RefreshCw size={16} aria-hidden="true" />重新读取评分</button></div>}
        </div>}

        {status === 'ready' && <form className="food-rating-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
          {!canRateLive && <p className="food-rating-context-note">当前可体验选星，提交不会保存到共享评分。</p>}
          <StarRating id={fieldId} label="你的评分" value={selected} onChange={(value) => { setSelected(value); setRatingError(''); setFeedback('') }} disabled={busy} required error={ratingError} />
          {feedback && <div ref={feedbackElement} className="food-rating-feedback" role="alert" tabIndex={-1}><Info size={18} aria-hidden="true" /><p>{feedback}</p></div>}
          <div className="food-rating-actions"><button className="food-rating-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={18} className="food-rating-spinner" aria-hidden="true" />提交评分中…</> : '提交评分'}</button><p>先选择星级，再点击提交。</p></div>
        </form>}
      </div>
    </section>
  )
}

export function FoodRatingPanel({ food, onRated }: FoodRatingPanelProps) {
  const mode = !food.isExample && isFoodBackendConfigured ? 'live' : 'example'
  return <FoodRatingPanelContent key={`${food.id}-${mode}`} food={food} onRated={onRated} />
}
