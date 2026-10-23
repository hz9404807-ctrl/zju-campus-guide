// Loaded explicitly by result-pager.js on the loopback-only fixture server.
// This module is absent from the application entry point and production bundle.
import { useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ResultPager from '../../../src/components/ResultPager'

let root: Root | undefined
export function mountPager(total: number, initialPage: number, disabled: boolean) {
  let host = document.getElementById('standalone-pager-fixture')
  if (!host) {
    host = document.createElement('div')
    host.id = 'standalone-pager-fixture'
    host.style.cssText = 'position:fixed;inset:0;z-index:10000;overflow:auto;background:#f5f7fb;padding:24px;'
    document.body.append(host)
    root = createRoot(host)
  }
  function Fixture() {
    const [page, setPage] = useState(initialPage)
    return <><h1 id="standalone-pager-title" tabIndex={-1}>本机分页夹具</h1><ResultPager page={page} total={total} pageSize={1} resultHeadingId="standalone-pager-title" onChange={setPage} disabled={disabled} /></>
  }
  root?.render(<Fixture key={`${total}:${initialPage}:${disabled}`} />)
}
