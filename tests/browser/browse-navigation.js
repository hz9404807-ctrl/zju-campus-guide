// Optional browser regression, using the isolated Vite configuration in docs/personal-center.md.
// playwright-cli -s=browse-navigation --raw run-code --filename=tests/browser/browse-navigation.js
// All remote requests are blocked or answered by fixtures. No cloud accounts/data are used.
async (page) => {
  const base = 'http://127.0.0.1:5176'
  const service = 'https://personal-center-test.invalid'
  const storageKey = 'sb-personal-center-test-auth-token'
  const checks = []
  const errors = []
  const unexpected = []
  const onError = (error) => errors.push(error.message)
  page.on('pageerror', onError)
  const intercept = async (route) => {
    const address = route.request().url()
    if (address.startsWith(base + '/')) return route.continue()
    unexpected.push(address)
    return route.abort('blockedbyclient')
  }
  const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
  const params = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))
  const canonicalSearch = () => page.evaluate(() => { const params = new URLSearchParams(location.search); params.sort(); return params.toString() })
  async function ready(selector) { await page.locator(selector).first().waitFor({ state: 'visible' }) }
  async function focusedResults(id) {
    await page.waitForFunction((target) => document.activeElement?.id === target, id)
    const geometry = await page.locator('#' + id).evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom,
      height: window.innerHeight,
    }))
    assert(geometry.top >= geometry.headerBottom && geometry.bottom <= geometry.height, id + ' is focused and visible below sticky navigation')
  }
  await page.context().route('**/*', intercept)
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(base + '/src/data/foods.example.json')
    await page.evaluate((key) => {
      const now = Math.floor(Date.now() / 1000)
      const user = { id: '33333333-3333-4333-8333-333333333333', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: { provider: 'anonymous', providers: ['anonymous'] }, user_metadata: {} }
      const part = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: now + 3600 })}.fixture`
      localStorage.setItem(key, JSON.stringify({ access_token: token, refresh_token: 'browse-fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }))
    }, storageKey)

    await page.goto(base + '/sources?kind=websites&category=' + encodeURIComponent('校园交通'))
    const sourceParams = await canonicalSearch()
    const busLink = page.locator('.website-guide-link[href^="/guides/campus-077"]').first()
    await busLink.waitFor()
    const detailHref = await busLink.getAttribute('href')
    const detailParams = await page.evaluate((href) => Object.fromEntries(new URL(href, location.origin).searchParams), detailHref)
    assert(!('category' in detailParams) && !('page' in detailParams) && !('kind' in detailParams), 'source-only filters do not leak into guide detail')
    await busLink.click()
    await ready('.guide-detail-page h1')
    assert((await page.locator('.breadcrumb').innerText()).includes('返回信息源列表'), 'guide names its original source list as the return destination')
    await page.goBack()
    await ready('.website-card')
    assert(await canonicalSearch() === sourceParams, 'browser back restores source category')
    await page.goForward()
    await ready('.guide-detail-page h1')
    await page.reload()
    await ready('.guide-detail-page h1')
    await page.locator('.guide-route-choices button').nth(1).click()
    await page.waitForFunction(() => document.querySelector('.guide-route-choices button:nth-child(2)')?.getAttribute('aria-pressed') === 'true')
    await page.reload()
    await ready('.guide-detail-page h1')
    await page.locator('.breadcrumb').click()
    await ready('.website-card')
    assert(await canonicalSearch() === sourceParams, 'refresh and procedure changes retain source-list filters')
    assert(await page.locator('#source-category').inputValue() === '校园交通', 'return does not produce a zero-result guide category')

    await page.goto(base + '/sources?kind=websites&page=2')
    await ready('.website-card')
    const sourceTitle = await page.locator('.website-card h3').first().innerText()
    await page.locator('.website-guide-link').first().click()
    await ready('.guide-detail-page h1')
    await page.locator('.guide-bottom-back').click()
    await ready('.website-card')
    assert((await params()).page === '2' && await page.locator('.website-card h3').first().innerText() === sourceTitle, 'return from a website guide restores the original source page')

    await page.goto(base + '/guides/campus-077?kind=websites&category=' + encodeURIComponent('校园交通') + '&page=1')
    await ready('.guide-detail-page h1')
    await page.locator('.breadcrumb').click()
    await ready('.website-card')
    assert(page.url().includes('/sources?'), 'legacy website links also return to the correct source column')

    await page.goto(base + '/guides?page=2')
    await ready('.guide-card-title')
    const title = await page.locator('.guide-card-title').first().innerText()
    await page.locator('.guide-card-title').first().click()
    await ready('.guide-detail-page h1')
    await page.locator('.breadcrumb').click()
    await ready('.guide-card-title')
    assert((await params()).page === '2' && await page.locator('.guide-card-title').first().innerText() === title, 'ordinary guide detail still returns to its original guide page')

    for (const [path, heading, items] of [['/guides', 'guide-results-heading', '.guide-result-card'], ['/sources', 'source-results-heading', '.account-card']]) {
      await page.goto(base + path + '?page=1.5')
      await ready(items)
      assert((await page.locator('.result-pager').innerText()).includes('第 1 /'), path + ' rejects fractional URL pages')
      const firstTitle = await page.locator(items).first().innerText()
      const next = page.getByRole('button', { name: '下一页', exact: true })
      await next.focus()
      await next.press('Enter')
      await page.waitForFunction(() => new URLSearchParams(location.search).get('page') === '2')
      await focusedResults(heading)
      assert(await page.locator(items).first().innerText() !== firstTitle, path + ' keyboard pagination renders the next results')
      await page.getByRole('button', { name: '上一页', exact: true }).click()
      await focusedResults(heading)
      assert((await params()).page === '1', path + ' mouse pagination restores page one')
    }

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base + '/sources?kind=websites&category=' + encodeURIComponent('校园交通'))
      await ready('.website-card')
      await page.locator('.website-guide-link[href^="/guides/campus-077"]').first().click()
      await ready('.guide-detail-page h1')
      await page.locator('.breadcrumb').click()
      await ready('.website-card')
      assert(await page.locator('#source-category').inputValue() === '校园交通', width + 'px source-guide return preserves the category')
      await page.goto(base + '/guides')
      await ready('.guide-card-title')
      await page.getByRole('button', { name: '下一页', exact: true }).click()
      await focusedResults('guide-results-heading')
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), width + 'px browsing has no horizontal overflow')
      await page.screenshot({ path: 'scratch/browse-experience-' + width + '.png', animations: 'disabled' })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(base + '/sources?kind=websites&category=' + encodeURIComponent('校园交通'))
    await ready('.website-card')
    await page.screenshot({ path: 'scratch/browse-experience-desktop.png', fullPage: true, animations: 'disabled' })
    assert(unexpected.length === 0, 'no requests reached real external services')
    assert(errors.length === 0, 'no uncaught browser errors')
    return { checks, unexpected, errors }
  } finally {
    await page.context().unroute('**/*', intercept)
    await page.evaluate((key) => localStorage.removeItem(key), storageKey).catch(() => {})
    page.off('pageerror', onError)
  }
}
