import { FoodArtwork } from '../components/CampusArtwork'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Info, MapPin, Plus, Search, Star, Utensils } from 'lucide-react'
import SearchField from '../components/SearchField'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useFoodResource } from '../hooks/useFoodResource'
import { getFood, isFoodBackendConfigured, isFoodExampleMode, listFoods } from '../lib/foodService'
import { FoodRatingPanel } from '../components/FoodRatingPanel'
import type { Food, FoodArea } from '../types/food'
import './food.css'
import FoodAccountBar from '../components/FoodAccountBar'
import { useFoodAuth } from '../hooks/useFoodAuth'

function FoodImage({ food, large = false }: { food: Food; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [food.image_url])
  return (
    <div className={`food-image${large ? ' food-image-large' : ''}`}>
      {food.image_url && !failed ? (
        <img src={food.image_url} alt={food.name} loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
      ) : (
        <div className="food-image-placeholder">
          <Utensils size={large ? 42 : 30} aria-hidden="true" />
          <span>{failed ? '图片暂时无法加载' : '暂无图片'}</span>
        </div>
      )}
    </div>
  )
}

function ExampleNotice() {
  return (
    <div className="food-example-notice">
      <Info size={20} aria-hidden="true" />
      <p><strong>当前展示的是示例数据</strong><span>菜品、地点、价格、评分和短评均为虚拟示例，供体验搜索和浏览。</span></p>
    </div>
  )
}

function RatingSummary({ food }: { food: Food }) {
  const prefix = food.isExample ? '示例' : ''
  return (
    <div className="food-rating-summary" aria-label={food.average_rating === null ? '暂无评分' : `${prefix}平均评分 ${food.average_rating.toFixed(1)} 分，${prefix}评分人数 ${food.rating_count} 人`}>
      <Star size={16} fill="currentColor" aria-hidden="true" />
      <strong>{food.average_rating === null ? '暂无评分' : food.average_rating.toFixed(1)}</strong>
      {food.average_rating !== null && <span>/ 5</span>}
      <span className="food-rating-count">{food.rating_count} 人评分{food.isExample ? ' · 示例' : ''}</span>
    </div>
  )
}

function FoodCard({ food, query }: { food: Food; query: string }) {
  return (
    <Link className="food-item-card" to={`/food/${food.id}${query}`}>
      <FoodImage food={food} />
      <div className="food-card-content">
        <div className="food-card-topline">{food.isExample && <span className="food-example-badge">示例数据</span>}<span className="food-category">{food.category}</span></div>
        <h2>{food.name}</h2>
        <p className="food-location"><MapPin size={15} aria-hidden="true" /><span>{food.location}</span></p>
        <div className="food-card-numbers">
          {food.price !== null && <span className="food-price">¥{food.price.toFixed(2)} {food.isExample && <small>示例</small>}</span>}
          <RatingSummary food={food} />
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
  const debouncedQuery = useDebouncedValue(query, 250)
  const resource = useFoodResource(listFoods, isFoodBackendConfigured ? debouncedQuery : '')
  const foods = resource.data ?? []
  const areaFoods = foods.filter((food) => food.area === area)
  const categories = [...new Set(areaFoods.map((food) => food.category))]
  const locations = [...new Set(areaFoods.map((food) => food.location))]
  const filteredFoods = useMemo(() => {
    const keywords = debouncedQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return foods.filter((food) => {
      if (food.area !== area || (category && food.category !== category) || (location && food.location !== location)) return false
      const searchable = [food.name, food.location, food.category, ...food.tags].join(' ').toLocaleLowerCase()
      return keywords.every((keyword) => searchable.includes(keyword))
    })
  }, [foods, area, category, location, debouncedQuery])

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
    setSearchParams({ area }, { replace: true })
  }

  const returnQuery = searchParams.toString()
  const detailQuery = returnQuery ? `?${returnQuery}` : ''

  return (
    <div className="page module-page food-page food-list-page">
      <div className="page-heading food-welcome">
        <Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link>
        <p className="eyebrow">校园里的烟火气</p>
        <div className="food-heading-actions"><div><h1>今天，吃点好的。</h1><p className="page-description">浙大美食点评 · 找到你喜欢的那一口。</p><Link className="food-publish-entry" to={`/food/new${searchParams.size ? `?${searchParams}` : ''}`}><Plus size={18} aria-hidden="true" />发布美食</Link></div><FoodArtwork /></div>
      </div>
      <FoodAccountBar auth={auth} />
      {isFoodExampleMode && <ExampleNotice />}
      <section className="food-search-panel" aria-label="搜索和筛选美食">
        <div className="food-area-tabs" role="group" aria-label="选择美食范围">
          <button type="button" className={`food-area-tab${area === 'campus' ? ' active' : ''}`} aria-pressed={area === 'campus'} onClick={() => changeArea('campus')}>校内食堂</button>
          <button type="button" className={`food-area-tab${area === 'off_campus' ? ' active' : ''}`} aria-pressed={area === 'off_campus'} onClick={() => changeArea('off_campus')}>校外美食</button>
        </div>
        <SearchField id="food-search" label="想吃什么？" placeholder="搜索菜品、食堂、店铺或品类" value={query} onChange={(value) => updateFilter('q', value)} hint="输入后自动查找，也可以试试“饭类”“面”或“店铺”。" />
        <div className="food-filters">
          <label className="food-select-field" htmlFor="food-category"><span>菜品分类</span><select id="food-category" value={category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">全部分类</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          {area === 'campus' && <label className="food-select-field" htmlFor="food-location"><span>食堂 / 窗口</span><select id="food-location" value={location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">全部地点</option>{locations.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>}
          {(query || category || location) && <button className="food-clear-filters" type="button" onClick={clearFilters}>清除筛选</button>}
        </div>
      </section>
      <div className="food-results-heading" aria-live="polite" aria-atomic="true"><h2>{area === 'campus' ? '校内食堂' : '校外美食'}</h2><span>{resource.loading ? '正在加载…' : resource.error ? '暂时无法显示菜品' : `${filteredFoods.length} 道${isFoodExampleMode ? '示例' : ''}菜品`}{query !== debouncedQuery ? ' · 正在查找…' : ''}</span>{isFoodBackendConfigured && <button type="button" className="food-clear-filters" onClick={resource.reload} disabled={resource.loading}>刷新列表</button>}</div>
      {resource.loading ? <FoodLoading /> : resource.error ? <FoodFailure message={resource.error} retry={resource.reload} /> : filteredFoods.length > 0 ? (
        <div className="food-grid">{filteredFoods.map((food) => <FoodCard food={food} query={detailQuery} key={food.id} />)}</div>
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
  const [searchParams] = useSearchParams()
  const loadFood = useCallback(() => getFood(foodId ?? ''), [foodId])
  const resource = useFoodResource(loadFood)
  const food = resource.data
  const returnParams = new URLSearchParams(searchParams)
  if (food && !returnParams.has('area')) returnParams.set('area', food.area)
  const returnQuery = returnParams.toString()
  const returnUrl = `/food${returnQuery ? `?${returnQuery}` : ''}`

  if (!food && (resource.loading || resource.error)) {
    return <div className="page module-page food-page"><Link to={returnUrl} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回美食列表</Link>{resource.loading ? <FoodLoading /> : <FoodFailure message={resource.error} retry={resource.reload} />}</div>
  }

  if (!food) {
    return (
      <div className="page module-page food-page"><Link to={returnUrl} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回美食列表</Link><section className="food-no-results"><span className="food-empty-icon"><Utensils size={28} aria-hidden="true" /></span><h1>这道菜暂时没有找到</h1><p>可能是链接有误，可以返回列表继续查找。</p><Link className="button-link" to={returnUrl}>返回美食列表 <ArrowRight size={16} aria-hidden="true" /></Link></section></div>
    )
  }

  return (
    <div className="page module-page food-page food-detail-page">
      <Link to={returnUrl} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回美食列表</Link>
      <FoodAccountBar auth={auth} />
      {food.isExample && <ExampleNotice />}
      <article className="food-detail-card">
        <FoodImage food={food} large />
        <div className="food-detail-content">
          <div className="food-card-topline">{food.isExample && <span className="food-example-badge">示例数据</span>}<span className="food-category">{food.area === 'campus' ? '校内食堂' : '校外美食'} · {food.category}</span></div>
          <h1>{food.name}</h1>
          {auth.user?.verifiedCampus && food.created_by === auth.user.id && food.updated_at && <div className="food-owner-actions"><Link className="button-link" to={`/food/${food.id}/edit${returnQuery ? `?${returnQuery}` : ''}`}>编辑这条发布</Link><Link className="button-link" to="/food/mine">管理或删除</Link></div>}
          <p className="food-location"><MapPin size={17} aria-hidden="true" /><span>{food.location}</span></p>
          {food.price !== null && <p className="food-detail-price">¥{food.price.toFixed(2)}<span>参考价格{food.isExample ? ' · 示例' : ''}</span></p>}
          <div className="food-detail-rating"><RatingSummary food={food} />{food.isExample && <p>平均分和评分人数为展示用示例。</p>}</div>
          <section className="food-detail-description"><h2>菜品介绍</h2><p>{food.description || '暂未填写菜品介绍。'}</p></section>
          {food.tags.length > 0 && <section className="food-detail-tags"><h2>短评标签 {food.isExample && <span>示例</span>}</h2><div className="food-tags">{food.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
        </div>
      </article>
      <FoodRatingPanel key={`${food.id}:${auth.user?.id ?? 'guest'}`} food={food} onRated={resource.refresh} />
      {resource.loading && <p role="status">正在更新平均分和评分人数…</p>}
      {resource.error && <FoodFailure message={`评分已提交，但统计暂时无法更新。${resource.error}`} retry={resource.refresh} />}
    </div>
  )
}

function FoodLoading() {
  return <section className="food-load-state" role="status"><span className="food-loading-dot" /><h2>正在加载美食…</h2><p>稍等一下，马上为你显示。</p></section>
}

function FoodFailure({ message, retry }: { message: string; retry: () => void }) {
  return <section className="food-load-state food-load-error" role="alert"><Info size={28} aria-hidden="true" /><h2>暂时无法加载</h2><p>{message}</p><button type="button" className="food-clear-button" onClick={retry}>重新加载</button></section>
}
