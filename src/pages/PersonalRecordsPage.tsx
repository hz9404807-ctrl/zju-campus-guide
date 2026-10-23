import { useCallback, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { ArrowLeft, ArrowRight, PenLine, Star } from 'lucide-react'
import { useFoodAuth } from '../hooks/useFoodAuth'
import { useFoodResource } from '../hooks/useFoodResource'
import { usePersonalRecordPagination } from '../hooks/usePersonalRecordPagination'
import { myRatings } from '../lib/foodService'
import { personalFoodUrl, personalPublishUrl } from '../lib/personalRecords'
import { OwnedFoodList } from '../components/OwnedFoodList'
import { FoodImage } from '../components/FoodImage'
import ResultPager from '../components/ResultPager'
import FoodAccountBar from '../components/FoodAccountBar'
import './food.css'
import './food-account.css'

function MyRatings() {
  const load = useCallback(() => myRatings(), [])
  const resource = useFoodResource(load)
  const pagination = usePersonalRecordPagination(resource.data && !resource.error ? resource.data.length : null)
  const items = resource.data?.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
  return <div aria-busy={resource.loading}>
    {resource.loading && <p className="account-state" role="status">正在加载我的评分…</p>}
    {resource.error && <div className="account-state" role="alert"><p>{resource.error}</p><button type="button" className="button-link" onClick={resource.reload}>重试我的评分</button></div>}
    {!resource.loading && !resource.error && !resource.data?.length && <div className="account-empty"><h2>还没有评分记录</h2><p>你实际提交的评分会出现在这里，包括发布菜品时的首次评分。</p><Link className="button-link" to="/food">去看看美食</Link></div>}
    <ul className="account-item-list">{items?.map((item) => <li key={item.food_id}>
      <article className={`account-rating${item.food ? ' account-rating-with-image' : ''}`}>
        <div className="account-rating-content">
          <div className="account-item-heading"><h2>{item.food ? <Link to={personalFoodUrl(item.food_id, pagination.returnUrl)}>{item.food.name}</Link> : '原菜品已撤下或不再可见'}</h2><span className="account-rating-score"><Star size={17} aria-hidden="true" />{item.rating} / 5 星</span></div>
          {item.food && <p className="account-item-meta">{item.food.location}</p>}
          <p className="account-item-meta">评分日期：<time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('zh-CN')}</time></p>
          {item.food ? <Link className="account-detail-link" to={personalFoodUrl(item.food_id, pagination.returnUrl)}>查看美食详情 <ArrowRight size={16} aria-hidden="true" /></Link> : <p className="food-account-hint">你的评分记录已保留，当前无法打开菜品详情。</p>}
        </div>
        {item.food && <FoodImage food={item.food} className="account-rating-image" />}
      </article>
    </li>)}</ul>
    {!resource.loading && !resource.error && <ResultPager page={pagination.page} total={resource.data?.length ?? 0} pageSize={pagination.pageSize} resultHeadingId="my-ratings-title" onChange={pagination.change} />}
  </div>
}

function PersonalRecordsPage({ kind }: { kind: 'posts' | 'ratings' }) {
  const auth = useFoodAuth()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const posts = kind === 'posts'
  const title = posts ? '我的发布' : '我的评分'
  const returnTo = location.pathname + location.search
  return <div className="page module-page personal-center-page personal-records-page">
    <div className="account-record-navigation"><Link className="breadcrumb" to="/account"><ArrowLeft size={16} aria-hidden="true" />返回个人中心</Link>
    <nav className="account-section-nav" aria-label="个人内容"><NavLink to="/account/posts"><PenLine size={17} aria-hidden="true" />我的发布</NavLink><NavLink to="/account/ratings"><Star size={17} aria-hidden="true" />我的评分</NavLink></nav></div>
    <div className="page-heading account-section-heading"><div><h1 id={posts ? 'my-posts-title' : 'my-ratings-title'} tabIndex={-1}>{title}</h1><p className="page-description">{posts ? '编辑、撤下或恢复你分享过的美食。' : '回看你实际提交过的评分。'}</p></div>{posts && auth.user?.verifiedCampus && <Link className="button-link" to={personalPublishUrl(returnTo)}>发布一道菜</Link>}</div>
    {!auth.loading && !auth.error && auth.user?.verifiedCampus && <FoodAccountBar auth={auth} profileLocked={busy} navigation="session" />}
    {auth.loading ? <div className="account-state" role="status">正在确认登录状态…</div> : auth.error ? <div className="account-state" role="alert"><h2>暂时无法确认账号</h2><p>{auth.error}</p><button className="button-link" type="button" onClick={auth.retry}>重试账号检查</button></div> : !auth.user?.verifiedCampus ? <section className="account-empty"><h2>登录后查看{title}</h2><p>使用已验证的浙大邮箱，继续查看自己的校园生活记录。</p><Link className="button-link" to={`/food/login?returnTo=${encodeURIComponent(returnTo)}`}>使用浙大邮箱登录 <ArrowRight size={17} aria-hidden="true" /></Link></section> : <section key={`${kind}:${auth.user.id}`} id={posts ? 'my-posts' : 'my-ratings'} aria-labelledby={posts ? 'my-posts-title' : 'my-ratings-title'}>{posts ? <OwnedFoodList onBusyChange={setBusy} /> : <MyRatings />}</section>}
  </div>
}

export function PersonalPostsPage() { return <PersonalRecordsPage kind="posts" /> }
export function PersonalRatingsPage() { return <PersonalRecordsPage kind="ratings" /> }
