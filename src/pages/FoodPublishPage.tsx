import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, CircleCheck, ImagePlus, Info, LoaderCircle, MapPin, Plus, X } from 'lucide-react'
import StarRating from '../components/StarRating'
import { isFoodBackendConfigured, getFood, listFoods, publishFood, updateFood } from '../lib/foodService'
import { FOOD_CATEGORIES, findSimilarFoods, toFoodPublishInput, validateFoodImage, validateFoodPublishDraft } from '../lib/foodValidation'
import type { FoodPublishDraft, FoodPublishErrors, FoodPublishField } from '../lib/foodValidation'
import type { Food } from '../types/food'
import './food-publish.css'
import { useFoodProfiles } from '../hooks/useFoodProfiles'
import { useFoodAuth } from '../hooks/useFoodAuth'
import FoodAccountBar from '../components/FoodAccountBar'
import { personalRecordReturn } from '../lib/personalRecords'

const fieldOrder: FoodPublishField[] = ['name', 'location', 'area', 'category', 'price', 'image', 'description', 'tags', 'rating']

function FieldError({ field, errors }: { field: FoodPublishField; errors: FoodPublishErrors }) {
  return errors[field] ? <p className="food-publish-field-error" id={`publish-${field}-error`}>{errors[field]}</p> : null
}

export function FoodPublishPage() {
  const auth = useFoodAuth()
  const location = useLocation()
  const { foodId } = useParams()
  if (!auth.loading && !auth.error && auth.user?.verifiedCampus) return <FoodPublishForm key={auth.user.id} />
  return <div className="page module-page food-publish-page">
    <Link className="breadcrumb" to="/account">返回个人中心</Link>
    <div className="page-heading"><h1>{foodId ? '编辑美食发布' : '发布一道菜'}</h1></div>
    <FoodAccountBar auth={auth} />
    {!auth.loading && !auth.error && <p className="food-account-notice">请先<Link to={`/food/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`}>使用浙大邮箱登录</Link>，再{foodId ? '编辑自己的发布' : '发布美食'}。</p>}
  </div>
}

function FoodPublishForm() {
  const auth = useFoodAuth()
  const profiles = useFoodProfiles()
  const profileId = profiles.active?.id
  const profileBlocked = profiles.enabled && (profiles.loading || !!profiles.error || !profileId)
  const { foodId } = useParams()
  const editing = !!foodId
  const [original, setOriginal] = useState<Food | null>(null)
  const [editLoading, setEditLoading] = useState(editing)
  const [editError, setEditError] = useState('')
  const [removeOriginalImage, setRemoveOriginalImage] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<FoodPublishDraft>(() => ({ name: searchParams.get('q') ?? '', location: '', area: searchParams.get('area') === 'off_campus' ? 'off_campus' : 'campus', category: '', price: '', description: '', tags: '', rating: 0 }))
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [errors, setErrors] = useState<FoodPublishErrors>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [published, setPublished] = useState<{ name: string; area: Food['area']; url: string } | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [similarLoadFailed, setSimilarLoadFailed] = useState(false)
  const [dismissedSimilarKey, setDismissedSimilarKey] = useState('')
  const imageInput = useRef<HTMLInputElement>(null)
  const feedbackElement = useRef<HTMLDivElement>(null)
  const successElement = useRef<HTMLDivElement>(null)
  const focusFreshDraft = useRef(false)
  const submissionLock = useRef(false)
  const mounted = useRef(true)
  const returnQuery = searchParams.toString()
  const personalReturn = personalRecordReturn(searchParams)
  const returnUrl = personalReturn?.url ?? `/food${returnQuery ? `?${returnQuery}` : ''}`
  const returnLabel = personalReturn?.label ?? '返回美食列表'
  const similarFoods = useMemo(() => findSimilarFoods(foods.filter((food) => food.id !== foodId && food.area === draft.area), draft.name, draft.location), [foods, foodId, draft.area, draft.name, draft.location])
  const similarKey = `${draft.area}\n${draft.name.trim()}\n${draft.location.trim()}`
  const showSimilar = similarFoods.length > 0 && dismissedSimilarKey !== similarKey

  useEffect(() => {
    mounted.current = true
    let active = true
    listFoods().then((items) => { if (active) setFoods(items) }).catch(() => { if (active) setSimilarLoadFailed(true) })
    return () => { active = false; mounted.current = false }
  }, [])

  useEffect(() => {
    if (!foodId || auth.loading || profiles.loading) return
    let active = true
    if (!auth.user?.verifiedCampus) { setEditLoading(false); return }
    if (profiles.enabled && profiles.error) { setEditError('档案暂不可用，请先重新加载档案。'); setEditLoading(false); return }
    setOriginal(null); setEditLoading(true); setEditError('')
    getFood(foodId).then((food) => {
      if (!active) return
      if (!food || food.created_by !== auth.user?.id) throw new Error('这条发布不存在，或不属于当前登录账号。')
      if (profiles.enabled && food.profile_id !== profileId) {
        if (food.profile_id && profiles.items.some((item) => item.id === food.profile_id)) {
          profiles.select(food.profile_id)
          return
        }
        throw new Error('无法加载这条发布所属的档案，请重新加载档案后再试。')
      }
      if (!food.updated_at) throw new Error('发布管理暂未开放，请稍后再试。')
      setOriginal(food)
      setDraft({ name: food.name, location: food.location, area: food.area, category: food.category, price: food.price === null ? '' : String(food.price), description: food.description, tags: food.tags.join('，'), rating: 1 })
      setEditLoading(false)
    }).catch((error) => { if (active) { setEditError(error instanceof Error ? error.message : '加载失败，请重试。'); setEditLoading(false) } })
    return () => { active = false }
  }, [foodId, auth.loading, auth.user?.id, auth.user?.verifiedCampus, profiles.enabled, profiles.loading, profiles.error, profileId])

  useEffect(() => {
    if (!image || validateFoodImage(image)) { setPreviewUrl(''); return }
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  useEffect(() => {
    if (feedback) feedbackElement.current?.focus({ preventScroll: false })
  }, [feedback])

  useEffect(() => {
    if (published) successElement.current?.focus()
    else if (focusFreshDraft.current) {
      focusFreshDraft.current = false
      document.getElementById('publish-name')?.focus()
    }
  }, [published])

  function updateDraft<K extends keyof FoodPublishDraft>(field: K, value: FoodPublishDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFeedback('')
  }

  function removeImage() {
    setImage(null)
    if (imageInput.current) imageInput.current.value = ''
    setErrors((current) => ({ ...current, image: undefined }))
    setFeedback('')
  }

  function continuePublishing() {
    if (!published || busy) return
    setDraft({ name: '', location: '', area: published.area, category: '', price: '', description: '', tags: '', rating: 0 })
    setImage(null)
    if (imageInput.current) imageInput.current.value = ''
    setPreviewUrl('')
    setErrors({})
    setFeedback('')
    setDismissedSimilarKey('')
    setRemoveOriginalImage(false)
    focusFreshDraft.current = true
    setPublished(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionLock.current || published) return
    setFeedback('')
    if (!auth.user?.verifiedCampus) { setFeedback('请先使用浙大邮箱登录。'); return }
    if (profileBlocked) { setFeedback('请先加载并选择一个档案，再提交发布。'); return }
    if (editing && (!original || editError || editLoading)) return
    const nextErrors = validateFoodPublishDraft({ ...draft, rating: editing ? 1 : draft.rating }, image)
    setErrors(nextErrors)
    const firstInvalid = fieldOrder.find((field) => nextErrors[field])
    if (firstInvalid) {
      const id = firstInvalid === 'rating' ? 'publish-rating-1' : firstInvalid === 'area' ? 'publish-area-campus' : `publish-${firstInvalid}`
      document.getElementById(id)?.focus()
      return
    }
    if (!isFoodBackendConfigured) {
      setFeedback('共享服务尚未连接，这次填写没有发布。')
      return
    }

    submissionLock.current = true
    setBusy(true)
    try {
      const input = toFoodPublishInput(draft)
      let savedId: string
      if (editing && original) { await updateFood(original.id, original.updated_at!, input, image, removeOriginalImage, profileId); savedId = original.id }
      else savedId = await publishFood(input, image, profileId)
      if (!mounted.current) return
      const nextQuery = new URLSearchParams(searchParams)
      nextQuery.set('area', input.area)
      const detailUrl = `/food/${encodeURIComponent(savedId)}?${nextQuery.toString()}`
      if (editing) navigate(detailUrl)
      else {
        // Only the service's completed write can enter this success state. Keep
        // the form unmounted until the author explicitly starts a fresh draft.
        setPublished({ name: input.name, area: input.area, url: detailUrl })
        setImage(null)
      }
    } catch (error) {
      if (mounted.current) setFeedback(error instanceof Error ? error.message : '菜品发布失败，请稍后重试。你的填写仍然保留。')
    } finally {
      submissionLock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  if (published && !editing) return (
    <div className="page module-page food-publish-page">
      <FoodAccountBar auth={auth} profileLocked={busy} />
      <div ref={successElement} className="food-publish-success" tabIndex={-1} aria-labelledby="publish-success-title">
        <div className="food-publish-success-icon"><CircleCheck size={32} aria-hidden="true" /></div>
        <p className="eyebrow">分享成功</p>
        <h1 id="publish-success-title">这道好味道，已经分享给同学了。</h1>
        <p className="food-publish-success-description" role="status">「{published.name}」已发布，你的首次评分也已保存。</p>
        <div className="food-publish-success-actions">
          <button type="button" className="food-publish-submit" onClick={continuePublishing} disabled={busy}><Plus size={19} aria-hidden="true" />继续发布一道菜</button>
          <Link className="food-publish-cancel" to={published.url}>查看刚发布的菜品<ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <Link className="food-publish-success-return" to={returnUrl}><ArrowLeft size={16} aria-hidden="true" />{returnLabel}</Link>
      </div>
    </div>
  )

  return (
    <div className="page module-page food-publish-page">
      <div className="page-heading">
        <Link className="breadcrumb" to={returnUrl}><ArrowLeft size={16} aria-hidden="true" /> {returnLabel}</Link>
        <p className="eyebrow">把吃过的好味道分享给同学</p>
        <h1>{editing ? '编辑美食发布' : '发布一道菜'}</h1>
        <p className="page-description">{editing ? '修改菜品信息，已有评分会保留。若换成另一道菜或另一家店，请新建发布。' : '填好菜品和地点，再留下你的第一次评分。'}</p>
      </div>
      <FoodAccountBar auth={auth} profileLocked={busy || (editing && !editError)} />
      {!auth.loading && !auth.user?.verifiedCampus && <p className="food-account-notice">请先<Link to={`/food/login?returnTo=${encodeURIComponent(editing ? `/food/${foodId}/edit` : `/food/new${returnQuery ? `?${returnQuery}` : ''}`)}`}>使用浙大邮箱登录</Link>，再{editing ? '编辑自己的发布' : '发布美食'}。</p>}
      {editLoading && <p role="status">正在加载原发布…</p>}{editError && <p role="alert">{editError}<Link to="/food/mine">返回我的发布</Link></p>}
      {!isFoodBackendConfigured && <div className="food-publish-offline"><Info size={20} aria-hidden="true" /><p><strong>共享功能尚未连接</strong><span>你可以体验填写、图片预览和校验。当前提交不会发布任何内容。</span></p></div>}
      <form className="food-publish-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <fieldset className="food-publish-fields" disabled={busy || auth.loading || !auth.user?.verifiedCampus || profileBlocked || editLoading || !!editError}>
          <div className="food-publish-form-heading"><h2>菜品信息</h2><span>标为“必填”的项目请填写</span></div>
          <div className="food-publish-grid">
            <div className="food-publish-field"><label htmlFor="publish-name">菜品名称 <span>必填</span></label><input id="publish-name" value={draft.name} maxLength={80} placeholder="例如：番茄鸡蛋饭" aria-required="true" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'publish-name-error' : undefined} onChange={(event) => updateDraft('name', event.target.value)} /><FieldError field="name" errors={errors} /></div>
            <div className="food-publish-field"><label htmlFor="publish-location">食堂窗口 / 店铺地点 <span>必填</span></label><input id="publish-location" value={draft.location} maxLength={120} placeholder="写清食堂、窗口或店铺位置" aria-required="true" aria-invalid={Boolean(errors.location)} aria-describedby={errors.location ? 'publish-location-error' : 'publish-location-hint'} onChange={(event) => updateDraft('location', event.target.value)} /><p className="food-publish-field-hint" id="publish-location-hint">尽量具体，方便同学找到这道菜。</p><FieldError field="location" errors={errors} /></div>
            <fieldset className="food-publish-area"><legend>所在范围 <span>必填</span></legend><div role="radiogroup" aria-label="所在范围" aria-required="true">{(['campus', 'off_campus'] as const).map((area) => <label key={area} className={draft.area === area ? 'is-selected' : ''}><input id={`publish-area-${area}`} type="radio" name="publish-area" value={area} checked={draft.area === area} onChange={() => updateDraft('area', area)} aria-invalid={Boolean(errors.area)} aria-describedby={errors.area ? 'publish-area-error' : undefined} /><span>{area === 'campus' ? '校内食堂' : '校外美食'}</span></label>)}</div><FieldError field="area" errors={errors} /></fieldset>
            <div className="food-publish-field"><label htmlFor="publish-category">菜品分类 <span>选填</span></label><select id="publish-category" value={draft.category} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'publish-category-error' : undefined} onChange={(event) => updateDraft('category', event.target.value)}><option value="">暂不选择</option>{FOOD_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select><FieldError field="category" errors={errors} /></div>
            <div className="food-publish-field"><label htmlFor="publish-price">参考价格（元）<span>选填</span></label><input id="publish-price" inputMode="decimal" value={draft.price} placeholder="例如：12.50" aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? 'publish-price-error' : 'publish-price-hint'} onChange={(event) => updateDraft('price', event.target.value)} /><p className="food-publish-field-hint" id="publish-price-hint">填写非负金额，最多保留两位小数。</p><FieldError field="price" errors={errors} /></div>
          </div>

          {showSimilar && <section className="food-publish-similar" aria-labelledby="publish-similar-title"><div><h3 id="publish-similar-title">可能已经有这道菜了</h3><p>先看看已有卡片，也可以继续创建新卡片。</p></div><div className="food-publish-similar-list">{similarFoods.map((food) => <Link key={food.id} to={`/food/${food.id}?area=${food.area}`}><div><strong>{food.name}</strong>{food.isExample && <span className="food-publish-example-badge">示例</span>}</div><p><MapPin size={14} aria-hidden="true" />{food.location}</p><span className="food-publish-similar-link">查看已有卡片 <ArrowRight size={14} aria-hidden="true" /></span></Link>)}</div><button type="button" className="food-publish-continue" disabled={busy} onClick={() => setDismissedSimilarKey(similarKey)}>仍然创建新卡片 <Check size={15} aria-hidden="true" /></button></section>}
          {similarLoadFailed && <p className="food-publish-field-hint">暂时无法检查相似菜品，你仍可以继续填写。</p>}

          <div className="food-publish-field food-publish-image-field"><label htmlFor="publish-image">菜品图片 <span>选填，最多 1 张</span></label><div className={`food-publish-image-control${errors.image ? ' is-invalid' : ''}`}><span><ImagePlus size={22} aria-hidden="true" /><span>选择一张图片</span></span><input ref={imageInput} id="publish-image" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-invalid={Boolean(errors.image)} aria-describedby={errors.image ? 'publish-image-error' : 'publish-image-hint'} onChange={(event) => { const file = event.target.files?.[0] ?? null; setImage(file); setErrors((current) => ({ ...current, image: validateFoodImage(file) })); setFeedback('') }} /></div><p className="food-publish-field-hint" id="publish-image-hint">支持 JPG、PNG、WEBP，图片不超过 5 MB。</p><FieldError field="image" errors={errors} />{image && <div className="food-publish-image-preview">{previewUrl && <img src={previewUrl} alt="尚未发布的菜品图片预览" />}<div><p>{image.name}</p><span>{previewUrl ? '仅本地预览，尚未上传' : '这张图片暂不可使用'}</span><button type="button" disabled={busy} onClick={removeImage}><X size={15} aria-hidden="true" />移除所选图片</button></div></div>}</div>
          <div className="food-publish-field"><label htmlFor="publish-description">菜品介绍 <span>选填</span></label><textarea id="publish-description" rows={4} maxLength={200} value={draft.description} placeholder="可以写写口味、分量，或值得留意的地方。" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'publish-description-error' : 'publish-description-hint'} onChange={(event) => updateDraft('description', event.target.value)} /><p className="food-publish-field-hint food-publish-character-count" id="publish-description-hint">{Array.from(draft.description).length} / 200 字</p><FieldError field="description" errors={errors} /></div>
          <div className="food-publish-field"><label htmlFor="publish-tags">短评标签 <span>选填</span></label><input id="publish-tags" value={draft.tags} placeholder="例如：分量充足，汤底清淡" aria-invalid={Boolean(errors.tags)} aria-describedby={errors.tags ? 'publish-tags-error' : 'publish-tags-hint'} onChange={(event) => updateDraft('tags', event.target.value)} /><p className="food-publish-field-hint" id="publish-tags-hint">用逗号分隔，最多 5 个，每个不超过 12 个字。</p><FieldError field="tags" errors={errors} /></div>
          {editing && original?.image_url && !removeOriginalImage && !image && <div className="food-publish-image-preview"><img src={original.image_url} alt="当前菜品图片" /><button type="button" disabled={busy} onClick={() => setRemoveOriginalImage(true)}>移除当前图片</button></div>}
          {editing && removeOriginalImage && <button type="button" disabled={busy} onClick={() => setRemoveOriginalImage(false)}>保留原图片</button>}
          {!editing && <div className="food-publish-rating"><StarRating id="publish-rating" label="你的第一次评分" value={draft.rating} onChange={(rating) => updateDraft('rating', rating)} disabled={busy} required error={errors.rating} /><p className="food-publish-rating-note">发布者也参与评分。这次评分会计入平均分，提交后不能修改。</p></div>}
        </fieldset>
        {feedback && <div ref={feedbackElement} className="food-publish-feedback" role="alert" tabIndex={-1}><Info size={20} aria-hidden="true" /><p>{feedback}</p></div>}
        <div className="food-publish-actions"><Link to={returnUrl} className="food-publish-cancel">{personalReturn ? returnLabel : '返回列表'}</Link><button className="food-publish-submit" type="submit" disabled={busy || auth.loading || !auth.user?.verifiedCampus || profileBlocked || editLoading || !!editError}>{busy ? <><LoaderCircle size={18} className="food-publish-spinner" aria-hidden="true" />{editing ? '保存中…' : image ? '上传图片并发布中…' : '发布中…'}</> : <>{editing ? '保存修改' : '发布菜品'} <ArrowRight size={18} aria-hidden="true" /></>}</button></div>
      {!isFoodBackendConfigured && <p className="food-publish-submit-note">当前提交只检查填写内容，不会发布到共享列表。</p>}
      </form>
    </div>
  )
}
