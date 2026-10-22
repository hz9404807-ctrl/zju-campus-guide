import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from '../../../src/App'
import { fixtureState, setFixtureState } from './food-service'
import '../../../src/styles.css'

function FixtureToolbar() {
  const [value, setValue] = useState(fixtureState)
  const update = (next: Parameters<typeof setFixtureState>[0]) => { setFixtureState(next); setValue(fixtureState()) }
  return <aside aria-label="隔离浏览器测试" style={{ padding: '12px 18px', background: '#fff6db', color: '#4f432b', borderBottom: '1px solid #e5c36c', font: '13px/1.6 sans-serif' }}>
    <strong>仅本机测试：模拟账号与菜品，保存只在此页内存中。</strong>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', marginTop: 6 }}>
      <label>测试身份 <select aria-label="测试身份" value={value.identity} onChange={(event) => update({ identity: event.target.value as typeof value.identity })}><option value="a">账号 A</option><option value="b">账号 B</option><option value="guest">未登录</option></select></label>
      <label>查询响应 <select aria-label="查询响应" value={value.readMode} onChange={(event) => update({ readMode: event.target.value as typeof value.readMode })}><option value="normal">正常</option><option value="empty">空记录</option><option value="failure">请求失败</option><option value="missing">资料接口未接入</option></select></label>
      <label><input aria-label="模拟写入失败" type="checkbox" checked={value.mutationFailure} onChange={(event) => update({ mutationFailure: event.target.checked })} /> 模拟写入失败</label>
      <label>响应延迟 <select aria-label="响应延迟" value={value.delay} onChange={(event) => update({ delay: Number(event.target.value) })}><option value={100}>100ms</option><option value={2500}>2500ms</option></select></label>
      <button type="button" onClick={() => { setFixtureState({ readMode: 'normal' }, false); setValue(fixtureState()) }}>恢复响应以重试</button>
      <button type="button" onClick={() => { update({ identity: 'a', readMode: 'normal', mutationFailure: false, delay: 100 }); window.location.href = '/account' }}>重置本地测试</button>
    </div>
  </aside>
}

// Vite can re-evaluate this test-only entry after fixture edits. Reuse its React
// root through the HMR data bag, while a full navigation still starts fresh.
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<><style>{'.account-details-card::before, #my-posts::before { content:"仅本机测试 · 模拟数据，保存仅在内存"; display:block; margin-bottom:16px; padding:6px 10px; background:#fff6db; color:#6c531d; border:1px solid #ead498; border-radius:6px; font:12px/1.6 sans-serif; }'}</style><FixtureToolbar /><BrowserRouter><App /></BrowserRouter></>)
