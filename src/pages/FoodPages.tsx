import { FoodArtwork } from '../components/CampusArtwork'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams, useLocation, useNavigationType } from 'react-router'
import { ArrowLeft, ArrowRight, Info, MapPin, Plus, Search, Star, Utensils } from 'lucide-react'
import { FoodImage } from '../components/FoodImage'
import SearchField from '../components/SearchField'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFoodResource } from '../hooks/useFoodResource'
import { getFood, isFoodBackendConfigured, isFoodExampleMode, listFoods } from '../lib/foodService'
import { FoodRatingPanel } from '../components/FoodRatingPanel'
import type { FoodArea } from '../types/food'
import './food.css'
import FoodAccountBar from '../components/FoodAccountBar'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { personalRecordReturn } from '../lib/personalRecords'
import { foodSortDescription, parseFoodSort, sortFoods } from '../lib/foodSorting'
import { useRatingSamples, type RatingSampleFood } from '../hooks/useRatingSamples'

function ExampleNotice() {
  return (
    <div className="food-example-notice">
      <Info size={20} aria-hidden="true" />
      <p><strong>当前展示的是示例数据</strong><span>菜品、地点、价格、评分和短评均为虚拟示例，供体验搜索和浏览。</span></p>
    </div>
  )
}

function RatingSummary({ food, sampleMode }: { food: RatingSampleFood; sampleMode: boolean }) {
  const prefix = sampleMode ? '评分样本' : food.isExample ? '示例' : ''
  const empty = sampleMode ? '暂无评分样本' : '暂无评分'
  return (
    <div className="food-rating-summary" aria-label={food.average_rating === null ? empty : sampleMode ? `评分样本平均分 ${food.average_rating.toFixed(1)} 分，共 ${food.rating_count} 份样本` : `${prefix}平均评分 ${food.average_rating.toFixed(1)} 分，${prefix}评分人数 ${food.rating_count} 人`}>
      <Star size={16} fill="currentColor" aria-hidden="true" />
      <strong>{food.average_rating === null ? empty : food.average_rating.toFixed(1)}</strong>
      {food.average_rating !== null && <span>/ 5</span>}
      <span className="food-rating-count">{sampleMode ? `${food.rating_count} 份评分样本` : `${food.rating_count} 人评分${food.isExample ? ' · 示例' : ''}`}</span>
    </div>
  )
}

let listReturn: { query: string; y: number } | null = null

function FoodCard({ food, query, sampleMode }: { food: RatingSampleFood; query: string; sampleMode: boolean }) {
  return (
    <Link onClick={() => { listReturn = { query, y: window.scrollY } }} className="food-item-card" to={`/food/${food.id}${query}`}>
      <FoodImage food={food} />
      <div className="food-card-content">
        <div className="food-card-topline">{food.isExample && <span className="food-example-badge">示例数据</span>}<span className="food-category">{food.category}</span></div>
        <h2>{food.name}</h2>
        <p className="food-location"><MapPin size={15} aria-hidden="true" /><span>{food.location}</span></p>
        <div className="food-card-numbers">
          <span className={`food-price${food.price === null ? ' food-price-unknown' : ''}`}>{food.price === null ? '价格待补充' : `¥${food.price.toFixed(2)}`} {food.isExample && <small>示例</small>}</span>
          <RatingSummary food={food} sampleMode={sampleMode} />
        </div>
        <div className="food-tags" aria-label={food.isExample ? '示例短评标签' : '短评标签'}>{food.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <span className="food-card-link">查看菜品 <ArrowRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  )
}

export function FoodPage() {
  const auth = useFoodAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const area: FoodArea = searchParams.get('area') === 'off_campus' ? 'off_campus' : 'campus'
  const query = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const location = area === 'campus' ? searchParams.get('location') ?? '' : ''
  const sort = parseFoodSort(searchParams.get('sort'))
  const sampleMode = searchParams.get('ratings') === 'sample'
  const debouncedQuery = useDebouncedValue(query, 250)
  const resource = useFoodResource(listFoods)
  const samples = useRatingSamples(resource.data ?? [], sampleMode)
  const foods = samples.foods
  const areaFoods = foods.filter((food) => food.area === area)
  const categories = [...new Set([...areaFoods.map((food) => food.category), category].filter(Boolean))]
  const locations = [...new Set([...areaFoods.map((food) => food.location), location].filter(Boolean))]
  const filteredFoods = useMemo(() => {
    const keywords = debouncedQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return sortFoods(foods.filter((food) => {
      if (food.area !== area || (category && food.category !== category) || (location && food.location !== location)) return false
      const searchable = [food.name, food.location, food.category, ...food.tags].join(' ').toLocaleLowerCase()
      return keywords.every((keyword) => searchable.includes(keyword))
    }), sort)
  }, [foods, area, category, location, debouncedQuery, sort])

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function changeArea(nextArea: FoodArea) {
    const next = new URLSearchParams(searchParams)
    next.set('area', nextArea)
    next.delete('category')
    next.delete('location')
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    for (const key of ['q', 'category', 'location']) next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const returnQuery = searchParams.toString()
  const detailQuery = returnQuery ? `?${returnQuery}` : ''
  const navigation = useNavigationType()
  const routeLocation = useLocation()
  const restore = useRef(listReturn && listReturn.query === detailQuery && (navigation === 'POP' || routeLocation.state?.foodReturn) ? listReturn.y : null)
  useEffect(() => {
    if (!resource.data || restore.current === null) return
    const y = restore.current
    restore.current = null
    listReturn = null
    const frame = requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [resource.data])

  return (
    <div className="page module-page food-page food-list-page">
      <div className="page-heading food-welcome">
        <Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link>
        
        <div className="food-heading-actions"><div><h1>今天，吃点好的。</h1><Link className="food-publish-entry" to={`/food/new${searchParams.size ? `?${searchParams}` : ''}`}><Plus size={18} aria-hidden="true" />发布美食</Link></div><FoodArtwork /></div>
      </div>
      <FoodAccountBar auth={auth} compact />
      {isFoodExampleMode && <ExampleNotice />}
      <RatingDataControls sampleMode={sampleMode} onToggle={() => updateFilter('ratings', sampleMode ? '' : 'sample')} />
      {samples.loading && <p className="food-sample-status" role="status">正在准备评分样本…</p>}
      {samples.error && <div className="food-sample-status" role="alert"><span>{samples.error}</span><button type="button" className="food-clear-filters" onClick={samples.retry}>重试评分样本</button></div>}
      <section className="food-search-panel" aria-label="搜索和筛选美食">
        <div className="food-area-tabs" role="group" aria-label="选择美食范围">
          <button type="button" className={`food-area-tab${area === 'campus' ? ' active' : ''}`} aria-pressed={area === 'campus'} onClick={() => changeArea('campus')}>校内食堂</button>
          <button type="button" className={`food-area-tab${area === 'off_campus' ? ' active' : ''}`} aria-pressed={area === 'off_campus'} onClick={() => changeArea('off_campus')}>校外美食</button>
        </div>
        <SearchField id="food-search" label="想吃什么？" placeholder="搜索菜品、食堂、店铺或品类" value={query} onChange={(value) => updateFilter('q', value)} />
        <div className="food-filters">
          <label className="food-select-field" htmlFor="food-category"><span>菜品分类</span><select id="food-category" value={category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">全部分类</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          {area === 'campus' && <label className="food-select-field" htmlFor="food-location"><span>食堂 / 窗口</span><select id="food-location" value={location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">全部地点</option>{locations.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>}
          <label className="food-select-field" htmlFor="food-sort"><span>排序方式</span><select id="food-sort" aria-label="排序方式" value={sort} aria-describedby={sort === 'latest' ? undefined : 'food-sort-description'} onChange={(event) => updateFilter('sort', event.target.value === 'latest' ? '' : event.target.value)}><option value="latest">默认顺序</option><option value="price-asc">价格：从低到高</option><option value="price-desc">价格：从高到低</option><option value="rating-asc">评分：从低到高</option><option value="rating-desc">评分：从高到低</option></select></label>
          {(query || category || location) && <button className="food-clear-filters" type="button" onClick={clearFilters}>清除筛选</button>}
        </div>
        {sort !== 'latest' && <p className="food-sort-description" id="food-sort-description">{sampleMode ? foodSortDescription(sort).replace('评分人数', '评分样本数') : foodSortDescription(sort)}</p>}
      </section>
      <div className="food-results-heading" aria-live="polite" aria-atomic="true"><h2>{area === 'campus' ? '校内食堂' : '校外美食'}</h2><span>{resource.loading ? (resource.data ? '正在更新，保留现有结果…' : '正在加载…') : resource.error ? '暂时无法显示菜品' : `${filteredFoods.length} 道${isFoodExampleMode ? '示例' : ''}菜品`}{query !== debouncedQuery ? ' · 正在查找…' : ''}</span>{isFoodBackendConfigured && <button type="button" className="food-clear-filters" onClick={resource.refresh} disabled={resource.loading}>刷新列表</button>}</div>
      {resource.error && <FoodFailure message={resource.error} retry={resource.refresh} />}
      {resource.loading && !resource.data ? <FoodLoading /> : !resource.data && resource.error ? null : filteredFoods.length > 0 ? (
        <div className="food-grid">{filteredFoods.map((food) => <FoodCard food={food} query={detailQuery} sampleMode={sampleMode} key={food.id} />)}</div>
      ) : (
        <section className="food-no-results" aria-labelledby="food-no-results-title">
          <span className="food-empty-icon"><Search size={28} aria-hidden="true" /></span>
          <h2 id="food-no-results-title">没有找到符合条件的菜品</h2>
          <p>试试更短的关键词，清除分类或地点筛选，也可以切换校内 / 校外范围。</p>
          <button className="food-clear-button" type="button" onClick={clearFilters}>清除筛选，查看全部</button>
          <Link className="food-publish-entry" to={`/food/new${searchParams.size ? `?${searchParams}` : ''}`}><Plus size={18} aria-hidden="true" />发布这道美食</Link>
        </section>
      )}
      <section className="food-sharing-note" aria-labelledby="food-sharing-title"><Utensils size={22} aria-hidden="true" /><div><h2 id="food-sharing-title">一起分享吃过的菜</h2><p>{isFoodBackendConfigured ? '使用浙大邮箱登录后，可以发布菜品，并对每道菜评分一次；在“个人中心”中查看自己的评分，编辑、撤下或恢复自己的发布。' : '可以体验发布表单和星级选择。共享服务尚未连接，填写内容和选择的星级不会保存到美食墙。'}</p></div></section>
    </div>
  )
}

export function FoodDetailPage() {
  const auth = useFoodAuth()
  const { foodId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const sampleMode = searchParams.get('ratings') === 'sample'
  const loadFood = useCallback(() => getFood(foodId ?? ''), [foodId])
  const resource = useFoodResource(loadFood)
  const food = resource.data
  const samples = useRatingSamples(food ? [food] : [], sampleMode)
  const personalReturn = personalRecordReturn(searchParams)
  const returnParams = new URLSearchParams(searchParams)
  returnParams.delete('returnTo')
  if (food && !returnParams.has('area')) returnParams.set('area', food.area)
  const returnQuery = returnParams.toString()
  const returnUrl = personalReturn?.url ?? `/food${returnQuery ? `?${returnQuery}` : ''}`
  const returnLabel = personalReturn?.label ?? '返回美食列表'
  const editQuery = personalReturn ? new URLSearchParams({ returnTo: personalReturn.url }).toString() : returnQuery

  if (!food && (resource.loading || resource.error)) {
    return <div className="page module-page food-page"><Link to={returnUrl} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> {returnLabel}</Link>{resource.loading ? <FoodLoading /> : <FoodFailure message={resource.error} retry={resource.reload} />}</div>
  }

  if (!food) {
    return (
      <div className="page module-page food-page"><Link to={returnUrl} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> {returnLabel}</Link><section className="food-no-results"><span className="food-empty-icon"><Utensils size={28} aria-hidden="true" /></span><h1>这道菜暂时没有找到</h1><p>可能是链接有误，可以返回列表继续查找。</p><Link className="button-link" to={returnUrl}>{returnLabel} <ArrowRight size={16} aria-hidden="true" /></Link></section></div>
    )
  }

  return (
    <div className="page module-page food-page food-detail-page">
      <Link to={returnUrl} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> {returnLabel}</Link>
      <FoodAccountBar auth={auth} />
      {food.isExample && <ExampleNotice />}
      <RatingDataControls sampleMode={sampleMode} onToggle={() => { const next = new URLSearchParams(searchParams); if (sampleMode) next.delete('ratings'); else next.set('ratings', 'sample'); setSearchParams(next, { replace: true }) }} />
      {samples.loading && <p className="food-sample-status" role="status">正在准备评分样本…</p>}
      {samples.error && <div className="food-sample-status" role="alert"><span>{samples.error}</span><button type="button" className="food-clear-filters" onClick={samples.retry}>重试评分样本</button></div>}
      <article className="food-detail-card">
        <FoodImage food={food} large />
        <div className="food-detail-content">
          <div className="food-card-topline">{food.isExample && <span className="food-example-badge">示例数据</span>}<span className="food-category">{food.area === 'campus' ? '校内食堂' : '校外美食'} · {food.category}</span></div>
          <h1>{food.name}</h1>
          {auth.user?.verifiedCampus && food.created_by === auth.user.id && food.updated_at && <div className="food-owner-actions"><Link className="button-link" to={`/food/${food.id}/edit${editQuery ? `?${editQuery}` : ''}`}>编辑这条发布</Link><Link className="button-link" to="/account/posts">管理我的发布</Link></div>}
          <p className="food-location"><MapPin size={17} aria-hidden="true" /><span>{food.location}</span></p>
          <p className={`food-detail-price${food.price === null ? ' food-price-unknown' : ''}`}>{food.price === null ? '价格待补充' : <>¥{food.price.toFixed(2)}<span>参考价格{food.isExample ? ' · 示例' : ''}</span></>}</p>
          <div className="food-detail-rating"><RatingSummary food={samples.foods[0] ?? food} sampleMode={sampleMode} />{food.isExample && <p>平均分和评分人数为展示用示例。</p>}</div>
          <section className="food-detail-description"><h2>菜品介绍</h2><p>{food.description || '暂未填写菜品介绍。'}</p></section>
          {food.tags.length > 0 && <section className="food-detail-tags"><h2>短评标签 {food.isExample && <span>示例</span>}</h2><div className="food-tags">{food.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
        </div>
      </article>
      {sampleMode ? <section className="food-rating-panel"><div><h2>当前查看评分样本</h2><p>返回真实评分后，可以使用已验证的浙大邮箱提交自己的评价。</p><Link className="text-link" to={routeWithoutSamples(searchParams, food.id)}>返回真实评分 <ArrowRight size={16} aria-hidden="true" /></Link></div></section> : <FoodRatingPanel key={`${food.id}:${auth.user?.id ?? 'guest'}`} food={food} onRated={resource.refresh} />}
      {resource.loading && <p role="status">正在更新平均分和评分人数…</p>}
      {resource.error && <FoodFailure message={`评分已提交，但统计暂时无法更新。${resource.error}`} retry={resource.refresh} />}
    </div>
  )
}

function routeWithoutSamples(params: URLSearchParams, foodId: string) {
  const next = new URLSearchParams(params)
  next.delete('ratings')
  return `/food/${foodId}${next.size ? `?${next}` : ''}`
}

function RatingDataControls({ sampleMode, onToggle }: { sampleMode: boolean; onToggle: () => void }) {
  return <div className="food-rating-data-controls"><span>{sampleMode ? '评分样本' : '真实评分'}</span><Link to="/about#rating-data">评分说明</Link><button type="button" onClick={onToggle}>{sampleMode ? '查看真实评分' : '体验评分样本'}</button></div>
}

function FoodLoading() {
  return <section className="food-load-state" role="status"><span className="food-loading-dot" /><h2>正在加载美食…</h2><p>稍等一下，马上为你显示。</p></section>
}

function FoodFailure({ message, retry }: { message: string; retry: () => void }) {
  return <section className="food-load-state food-load-error" role="alert"><Info size={28} aria-hidden="true" /><h2>暂时无法加载</h2><p>{message}</p><button type="button" className="food-clear-button" onClick={retry}>重新加载</button></section>
}
