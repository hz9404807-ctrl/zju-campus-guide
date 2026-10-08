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
  X,
} from 'lucide-react'
import { GuideDetailPage, GuidePage } from './pages/GuidePages'
import { FoodDetailPage, FoodPage } from './pages/FoodPages'
import { FoodPublishPage } from './pages/FoodPublishPage'
import { initializeFoodIdentity } from './lib/foodService'

const navigation = [
  { to: '/', label: '首页' },
  { to: '/guides', label: '校园办事' },
  { to: '/food', label: '美食点评' },
  { to: '/sources', label: '信息源导航' },
]

const pageTitles: Record<string, string> = {
  '/': '校园信息，一处找到',
  '/guides': '校园办事指南',
  '/food': '浙大美食点评',
  '/food/new': '发布美食',
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
        <p className="eyebrow"><span className="status-dot" />让校园生活更简单一点</p>
        <h1 id="home-title">浙大校园信息，<br /><span>一处找到。</span></h1>
        <p className="hero-description">办事少走弯路，吃饭少点纠结。<br />把分散的校园信息，整理成你需要的答案。</p>
      </section>

      <section className="module-grid" aria-label="选择你需要的服务">
        <Link to="/guides" className="module-card guide-card">
          <div className="card-top">
            <span className="module-icon blue"><ClipboardList size={29} aria-hidden="true" /></span>
            <span className="card-number" aria-hidden="true">01</span>
          </div>
          <h2>校园办事指南</h2>
          <p>遇到问题，从这里找答案。<br />办理步骤、材料和地点，清楚地放在一起。</p>
          <div className="card-tags"><span>按问题查找</span><span>步骤与来源</span></div>
          <span className="card-link">进入办事指南 <ArrowRight size={20} aria-hidden="true" /></span>
        </Link>

        <Link to="/food" className="module-card food-card">
          <div className="card-top">
            <span className="module-icon warm"><Utensils size={29} aria-hidden="true" /></span>
            <span className="card-number" aria-hidden="true">02</span>
          </div>
          <h2>浙大美食点评</h2>
          <p>今天吃什么，看看同学怎么说。<br />校园内外的菜品、地点和评分，一起了解。</p>
          <div className="card-tags"><span>校内食堂</span><span>校外美食</span></div>
          <span className="card-link">进入美食点评 <ArrowRight size={20} aria-hidden="true" /></span>
        </Link>
      </section>

      <Link to="/sources" className="source-banner">
        <span className="source-icon"><Compass size={25} aria-hidden="true" /></span>
        <div><h2>校园信息源导航</h2><p>常用校园网站与公众号，集中整理，方便查找。</p></div>
        <span className="source-status">正在整理中 <ArrowRight size={17} aria-hidden="true" /></span>
      </Link>

      <div className="home-note"><Info size={17} aria-hidden="true" /><p>信息正在逐步整理和核验，办事指南请以最新官方通知为准。</p></div>
    </div>
  )
}

function SourcesPage() {
  return (
    <div className="page module-page">
      <div className="page-heading">
        <Link to="/" className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> 返回首页</Link>
        <p className="eyebrow">找到信息，也找到它的出处</p>
        <h1>校园信息源导航</h1>
        <p className="page-description">常用校园网站与公众号的统一入口。</p>
      </div>
      <section className="module-empty">
        <span className="empty-icon blue"><Compass size={32} aria-hidden="true" /></span>
        <h2>正在整理中，敬请期待</h2>
        <p>我们会逐步整理校园活动、讲座、竞赛等常用信息来源。</p>
        <Link to="/" className="button-link">返回首页 <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
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
        <article className="about-card"><h2>信息从哪里来？</h2><p>办事指南将注明来源和最后核验时间；未确认的信息会明确标记。美食点评由使用者共同分享。</p></article>
        <article className="about-card"><h2>现在进展到哪里？</h2><p>办事搜索、美食浏览、发布表单和星级选择已可用。美食共享服务未连接时会显示明确的示例与未提交提示。这里是《人类工效学》课程项目，不是学校官方平台。</p></article>
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
    const title = pageTitles[location.pathname] ?? (location.pathname.startsWith('/guides/') ? '办事指南详情' : location.pathname.startsWith('/food/') ? '美食详情' : '页面未找到')
    document.title = `${title} · 浙大校园指南`
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      mainContent.current?.focus({ preventScroll: true })
      previousPath.current = location.pathname
    }
  }, [location.pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳转到主要内容</a>
      <Header />
      <main className="main-content" id="main-content" ref={mainContent} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guides" element={<GuidePage />} />
          <Route path="/guides/:guideId" element={<GuideDetailPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/food/new" element={<FoodPublishPage />} />
          <Route path="/food/:foodId" element={<FoodDetailPage />} />
          <Route path="/sources" element={<SourcesPage />} />
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
