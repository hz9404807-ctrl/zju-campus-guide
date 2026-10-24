import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import './guide-journey.css'

export default function GuideContents({ sections, pathname, search, hash }: { sections: { id: string; label: string }[]; pathname: string; search: string; hash: string }) {
  const navigation = useRef<HTMLElement>(null)
  useEffect(() => {
    const header = document.querySelector('.site-header')
    const measure = () => navigation.current?.style.setProperty('--guide-nav-top', `${header?.getBoundingClientRect().height ?? 80}px`)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (header) observer?.observe(header)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  return <nav ref={navigation} className="guide-contents" aria-label="本页内容"><p>快速查看</p><ul>{sections.map(section => <li key={section.id}><Link to={{ pathname, search, hash: `#${section.id}` }} aria-current={hash === `#${section.id}` ? 'location' : undefined}>{section.label}</Link></li>)}</ul></nav>
}
