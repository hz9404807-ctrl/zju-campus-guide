import { CampusArtwork, FoodArtwork } from './components/CampusArtwork'
import FoodAccountProvider from './components/FoodAccountProvider'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Compass,
  Info,
  Menu,
  Utensils,
  UserRound,
  X,
} from 'lucide-react'
import { GuideDetailPage, GuidePage } from './pages/GuidePages'
import { FoodDetailPage, FoodPage } from './pages/FoodPages'
import { FoodPublishPage } from './pages/FoodPublishPage'
import { FoodLoginPage } from './pages/FoodLoginPage'
import { FoodMinePage } from './pages/FoodMinePage'
import { PersonalCenterPage } from './pages/PersonalCenterPage'
import { SourcesPage, SourceDetailPage } from './pages/SourcePages'
import contentManifest from './data/content-manifest.json'
import { initializeFoodIdentity } from './lib/foodService'

const navigation = [
  { to: '/', label: '首页' },
  { to: '/guides', label: '校园办事' },
  { to: '/food', label: '美食点评' },
  { to: '/sources', label: '信息源导航' },
  { to: '/account', label: '个人中心' },
]

const pageTitles: Record<string, string> = {
  '/': '校园信息，一处找到',
  '/guides': '校园办事指南',
  '/food': '浙大美食点评',
  '/food/new': '发布美食',
  '/food/login': '浙大邮箱登录',
  '/food/mine': '我的发布',
  '/account': '个人中心',
  '/sources': '校园信息源导航',
  '/about': '关于项目',
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const links = navigation.map(({ to, label }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={() => setMenuOpen(false)}
    >
      {label}
    </NavLink>
  ))

  return (
    <header
      className="site-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false)
          menuButton.current?.focus()
        }
      }}
    >
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="浙大校园指南，返回首页">
          <span className="brand-mark"><BookOpen size={23} aria-hidden="true" /></span>
          <span className="brand-copy"><strong>浙大校园指南</strong><span>校园生活，一处找到</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="主导航">{links}</nav>
        <NavLink to="/about" className="about-link">关于项目</NavLink>
        <NavLink to="/account" className="mobile-account-entry" aria-label="个人中心" title="个人中心"><UserRound size={21} aria-hidden="true" /></NavLink>
        <button
          ref={menuButton}
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>
      {menuOpen && (
        <nav className="mobile-nav" id="mobile-navigation" aria-label="手机主导航">
          {links}
          <NavLink to="/about" className="nav-link" onClick={() => setMenuOpen(false)}>关于项目</NavLink>
        </nav>
      )}
    </header>
  )
}

function HomePage() {
  return (
    <div className="page home-page">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy"><p className="eyebrow">在浙里 · 过好校园每一天</p>
          <h1 id="home-title">校园大小事，<br /><span>都有好去处。</span></h1>
          <p className="hero-description">找清楚的办事指引，也找一顿喜欢的饭。<br />你的校园生活，从这里出发。</p>
          <Link className="hero-action" to="/guides">查找办事指南 <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="hero-art"><CampusArtwork /><span className="hero-art-caption">求知 · 办事 · 好好生活</span></div>
      </section>
      <div className="home-section-heading"><h2>今天，从哪件事开始？</h2><span>校园生活的三个入口</span></div>

      <section className="module-grid" aria-label="选择你需要的服务">
        <Link to="/guides" className="module-card guide-card">
          <div className="card-top">
            <span className="module-icon blue"><ClipboardList size={29} aria-hidden="true" /></span>
            <span className="module-category">办事有章可循</span>
          </div>
          <h2>校园办事指南</h2>
          <p>遇到问题，从这里找答案。<br />办理步骤、材料和地点，清楚地放在一起。</p>
          <div className="card-tags"><span>{contentManifest.guideCount}份指南</span><span>答案与来源</span></div>
          <span className="card-link">进入办事指南 <ArrowRight size={20} aria-hidden="true" /></span>
        </Link>

        <Link to="/food" className="module-card food-card">
          <div className="card-top">
            <span className="module-icon warm"><Utensils size={29} aria-hidden="true" /></span>
            <span className="module-category">认真吃饭，好好生活</span>
          </div>
          <FoodArtwork /><h2>浙大美食点评</h2>
          <p>今天吃什么，看看同学怎么说。<br />校园内外的菜品、地点和评分，一起了解。</p>
          <div className="card-tags"><span>校内食堂</span><span>校外美食</span></div>
          <span className="card-link">进入美食点评 <ArrowRight size={20} aria-hidden="true" /></span>
        </Link>
      </section>

      <Link to="/sources" className="source-banner">
        <span className="source-icon"><Compass size={25} aria-hidden="true" /></span>
        <div><h2>校园信息源导航</h2><p>常用校园网站与公众号，集中整理，方便查找。</p></div>
        <span className="source-status">{contentManifest.accountCount}个公众号 · {contentManifest.websiteCount}个网站 <ArrowRight size={17} aria-hidden="true" /></span>
      </Link>

      <div className="home-note"><Info size={17} aria-hidden="true" /><p>信息正在逐步整理和核验，办事指南请以最新官方通知为准。</p></div>
    </div>
  )
}

function AboutPage() {
  return (
    <div className="page module-page about-page">
      <div className="page-heading">
        <Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link>
        <p className="eyebrow">一个来自同学的课程项目</p>
        <h1>关于浙大校园指南</h1>
        <p className="page-description">少一点来回查找，多一点清楚的答案。</p>
      </div>
      <div className="about-grid">
        <article className="about-card"><h2>为什么做这个网站？</h2><p>校园信息分散在不同网站、公众号和群聊中。我们希望把常用信息重新整理，让办事和寻找美食更方便。</p></article>
        <article className="about-card"><h2>信息从哪里来？</h2><p>办事指南来自小组问题收集表，公众号来自截图与整理清单；每条保留来源，部分内容已官网核对。美食点评由使用者共同分享。</p></article>
        <article className="about-card"><h2>现在进展到哪里？</h2><p>办事搜索、公众号与网站导航已补入小组资料；美食上传、发布和评分已连接共享服务。这里是《人类工效学》课程项目，不是学校官方平台。</p></article>
      </div>
      <Link to="/" className="text-link">返回首页 <ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="page module-page not-found">
      <section className="module-empty">
        <span className="empty-icon blue"><Compass size={32} aria-hidden="true" /></span>
        <h1>这个页面还没有找到</h1>
        <p>可以返回首页，从校园办事或美食点评继续浏览。</p>
        <Link to="/" className="button-link">返回首页 <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const mainContent = useRef<HTMLElement>(null)

  useEffect(() => {
    initializeFoodIdentity().catch(() => { /* 美食页面会显示连接失败并提供重试。 */ })
  }, [])

  useEffect(() => {
    const title = pageTitles[location.pathname] ?? (location.pathname.startsWith('/guides/') ? '办事指南详情' : location.pathname.startsWith('/sources/') ? '公众号信息' : location.pathname.startsWith('/food/') ? '美食详情' : '页面未找到')
    document.title = `${title} · 浙大校园指南`
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      mainContent.current?.focus({ preventScroll: true })
      previousPath.current = location.pathname
    }
  }, [location.pathname])

  return (
    <div className={`app-shell ${location.pathname.startsWith('/food') ? 'theme-food' : 'theme-information'}`}>
      <a className="skip-link" href="#main-content">跳转到主要内容</a>
      <Header />
      <main className="main-content" id="main-content" ref={mainContent} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guides" element={<GuidePage />} />
          <Route path="/guides/:guideId" element={<GuideDetailPage />} />
          <Route element={<FoodAccountProvider />}>
            <Route path="/account" element={<PersonalCenterPage />} />
            <Route path="/food" element={<FoodPage />} />
            <Route path="/food/login" element={<FoodLoginPage />} />
            <Route path="/food/mine" element={<FoodMinePage />} />
            <Route path="/food/:foodId/edit" element={<FoodPublishPage key={location.pathname} />} />
            <Route path="/food/new" element={<FoodPublishPage key={location.pathname} />} />
            <Route path="/food/:foodId" element={<FoodDetailPage />} />
          </Route>
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/sources/:sourceId" element={<SourceDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="footer-inner"><span>浙大校园指南</span><p className="footer-project">《人类工效学》课程项目 · 非学校官方平台</p></div>
      </footer>
    </div>
  )
}
