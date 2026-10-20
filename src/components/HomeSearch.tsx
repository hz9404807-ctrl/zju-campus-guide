import { lazy, Suspense, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import SearchField from './SearchField'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import './home-search.css'
const Results=lazy(()=>import('./UnifiedSearchResults'))
export default function HomeSearch() {
  const [params,setParams]=useSearchParams()
  const location=useLocation()
  useEffect(()=>{if(location.hash==='#home-search'){const frame=requestAnimationFrame(()=>document.getElementById('home-search')?.scrollIntoView({block:'start'}));return()=>cancelAnimationFrame(frame)}},[location.hash])
  const query=(params.get('q')??'').slice(0,200)
  const debounced=useDebouncedValue(query,200)
  return <section id="home-search" className="home-search" aria-label="统一查找校园信息">
    <SearchField id="home-query" label="你想办什么事？" placeholder="直接输入问题，例如：成绩单怎么打印" hint="一起查找办事指南、官方入口和公众号；美食可从下方入口浏览。" value={query} onChange={value=>{const next=new URLSearchParams();if(value)next.set('q',value.slice(0,200));setParams(next,{replace:true})}} />
    {!query.trim() && <div className="home-search-examples"><span>常用：</span>{['成绩单','校园卡丢了','宿舍报修','VPN'].map(q=><button key={q} type="button" onClick={()=>setParams({q},{replace:true})}>{q}</button>)}</div>}
    {!!query.trim() && <div aria-busy={query!==debounced}><Suspense fallback={<p role="status">正在加载校园资料…</p>}><Results query={debounced} /></Suspense></div>}
  </section>
}
