import { useState } from 'react'
import { Link } from 'react-router'
import { useFoodProfiles } from '../hooks/useFoodProfiles'
import { useFoodAuth } from '../hooks/useFoodAuth'
import FoodAccountBar from '../components/FoodAccountBar'
import { OwnedFoodList } from '../components/OwnedFoodList'
import './food.css'
import './food-account.css'
export function FoodMinePage() {
  const auth = useFoodAuth()
  const profiles = useFoodProfiles()
  const [busy, setBusy] = useState(false)
  return <div className="page module-page food-page"><Link className="breadcrumb" to="/account">返回个人中心</Link><div className="page-heading"><h1 id="my-posts-title" tabIndex={-1}>我的发布</h1><p className="page-description">编辑菜品信息，或撤下不再需要的发布。撤下后可以恢复，已有评分保留。</p></div><FoodAccountBar auth={auth} profileLocked={busy} />
    {!auth.loading && !auth.error && !auth.user?.verifiedCampus && <p className="food-account-notice">请<Link to="/food/login?returnTo=%2Ffood%2Fmine">使用浙大邮箱登录</Link>查看自己的发布。已有匿名发布请在原浏览器完成邮箱绑定。</p>}
    {!auth.loading && !auth.error && auth.user?.verifiedCampus && <OwnedFoodList key={`${auth.user.id}:${profiles.active?.id ?? ''}`} onBusyChange={setBusy} />}
  </div>
}
