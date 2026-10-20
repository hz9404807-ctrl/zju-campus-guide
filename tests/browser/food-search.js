// Optional isolated UI regression: playwright-cli -s=food-search --raw run-code --filename=tests/browser/food-search.js
// Use the same Vite fixture configuration as docs/personal-center.md on 127.0.0.1:5176.
// All external requests are intercepted. Names, session and responses below are test fixtures;
// this checks filtering and refresh behaviour, never real cloud persistence or authentication.
async (page) => {
  const base = 'http://127.0.0.1:5176'
  const service = 'https://personal-center-test.invalid'
  const storageKey = 'sb-personal-center-test-auth-token'
  const userId = '33333333-3333-4333-8333-333333333333'
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: { provider: 'anonymous', providers: ['anonymous'] }, user_metadata: {}, created_at: '2026-10-20T00:00:00Z' }
  const rows = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '回归米饭一', area: 'campus', category: '饭类', location: '测试食堂甲' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: '回归米饭二', area: 'campus', category: '饭类', location: '测试食堂乙' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: '回归面条', area: 'campus', category: '面类', location: '测试食堂甲' },
    { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: '回归店铺饭', area: 'off_campus', category: '饭类', location: '测试校外店铺' },
    { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: '回归店铺面', area: 'off_campus', category: '面类', location: '测试校外店铺' },
  ].map((row) => ({ price: 12, description: '仅用于浏览器隔离回归测试', tags: ['测试夹具'], image_url: null, average_rating: 4, rating_count: 1, created_by: userId, deleted_at: null, created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z', ...row }))
  const checks = []
  const errors = []
  const unexpected = []
  const onPageError = (error) => errors.push(error.message)
  page.on('pageerror', onPageError)
  let reads = 0
  let failReads = false
  let heldRead = null
  let releaseHeldRead = () => {}
  const fixtureRoute = async (route) => {
    const request = route.request()
    if (request.url().startsWith(base + '/')) return route.continue()
    if (!request.url().startsWith(service + '/')) {
      unexpected.push(request.url())
      return route.abort('blockedbyclient')
    }
    const path = request.url().slice(service.length).split('?')[0]
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/auth/v1/user') return reply(user)
    if (path === '/rest/v1/food_summaries') {
      reads += 1
      if (heldRead) { const pending = heldRead; heldRead = null; pending.started(); await pending.release }
      if (failReads) return reply({ message: 'isolated fixture query failure' }, 503)
      return reply(rows)
    }
    unexpected.push(path)
    return reply({ message: 'Unexpected fixture endpoint: ' + path }, 400)
  }
  const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
  const cards = page.locator('.food-grid .food-item-card')
  const settleSearch = () => page.waitForTimeout(350)
  async function expectCards(names) {
    await page.waitForFunction((expected) => {
      const actual = [...document.querySelectorAll('.food-item-card h2')].map((heading) => heading.textContent)
      return JSON.stringify(actual) === JSON.stringify(expected)
    }, names)
  }
  async function unchanged(label, action, names, baseline) {
    await action()
    await settleSearch()
    await expectCards(names)
    assert(reads === baseline, label + ' filters the loaded list without another request')
  }
  await page.context().route('**/*', fixtureRoute)
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // Visit a static local document before seeding the SDK's fixture session;
    // the app must not race an anonymous bootstrap while the fixture is installed.
    await page.goto(base + '/src/data/foods.example.json')
    await page.evaluate(({ key, user }) => {
      const now = Math.floor(Date.now() / 1000)
      const part = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const access_token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: now + 3600 })}.fixture`
      localStorage.setItem(key, JSON.stringify({ access_token, refresh_token: 'food-search-fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }))
    }, { key: storageKey, user })
    await page.goto(base + '/food')
    await expectCards(['回归米饭一', '回归米饭二', '回归面条'])
    await settleSearch()
    const baseline = reads
    assert(baseline > 0, 'initial food list comes from the intercepted shared-service endpoint')
    // Track intermediate commits as well as the final state: matching filters
    // should not replace already loaded cards with the network loading screen.
    await page.evaluate(() => {
      const probe = { droppedCards: false, showedLoading: false }
      const observe = () => {
        if (!document.querySelector('.food-item-card')) probe.droppedCards = true
        if ([...document.querySelectorAll('.food-load-state h2')].some((heading) => heading.textContent === '正在加载美食…')) probe.showedLoading = true
      }
      const observer = new MutationObserver(observe)
      observer.observe(document.querySelector('main'), { childList: true, subtree: true })
      window.__foodSearchFixture = { probe, observer }
    })
    const search = page.getByRole('searchbox', { name: '想吃什么？' })
    await unchanged('first keyword', () => search.fill('回归'), ['回归米饭一', '回归米饭二', '回归面条'], baseline)
    await unchanged('longer keyword', () => search.fill('回归米'), ['回归米饭一', '回归米饭二'], baseline)
    await unchanged('changed keyword', () => search.fill('回归'), ['回归米饭一', '回归米饭二', '回归面条'], baseline)
    await unchanged('category', () => page.getByRole('combobox', { name: '菜品分类', exact: true }).selectOption('饭类'), ['回归米饭一', '回归米饭二'], baseline)
    await unchanged('location', () => page.getByRole('combobox', { name: '食堂 / 窗口', exact: true }).selectOption('测试食堂甲'), ['回归米饭一'], baseline)
    await unchanged('off-campus area', () => page.getByRole('button', { name: '校外美食', exact: true }).click(), ['回归店铺饭', '回归店铺面'], baseline)
    assert(await page.getByRole('combobox', { name: '菜品分类', exact: true }).inputValue() === '' && await page.locator('#food-location').count() === 0, 'area change clears incompatible category and location filters')
    await unchanged('off-campus category', () => page.getByRole('combobox', { name: '菜品分类', exact: true }).selectOption('面类'), ['回归店铺面'], baseline)
    await unchanged('campus area', () => page.getByRole('button', { name: '校内食堂', exact: true }).click(), ['回归米饭一', '回归米饭二', '回归面条'], baseline)
    const probe = await page.evaluate(() => {
      const fixture = window.__foodSearchFixture
      fixture.observer.disconnect()
      delete window.__foodSearchFixture
      return fixture.probe
    })
    assert(!probe.droppedCards && !probe.showedLoading, 'matching searches and filters never clear the list or show network loading')
    await unchanged('clearing search', () => page.getByRole('button', { name: '清空搜索', exact: true }).click(), ['回归米饭一', '回归米饭二', '回归面条'], baseline)
    await page.setViewportSize({ width: 390, height: 900 })
    await unchanged('mobile search', () => search.fill('回归面'), ['回归面条'], baseline)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile food filtering has no horizontal overflow at 390px')
    await unchanged('mobile clear filters', () => page.getByRole('button', { name: '清除筛选', exact: true }).click(), ['回归米饭一', '回归米饭二', '回归面条'], baseline)
    // A held refresh proves this is an actual user-requested fetch, and a
    // transient server failure must expose the existing retry control.
    let started
    const startedPromise = new Promise((resolve) => { started = resolve })
    heldRead = { started, release: new Promise((resolve) => { releaseHeldRead = resolve }) }
    failReads = true
    await page.getByRole('button', { name: '刷新列表', exact: true }).click()
    await startedPromise
    await page.waitForFunction(()=>document.querySelector('.food-results-heading button')?.disabled)
    assert(await cards.count() === 3, 'pending refresh preserves the loaded list')
    assert(reads === baseline + 1 && await page.getByRole('button', { name: '刷新列表', exact: true }).isDisabled(), 'manual refresh performs one new fetch and disables repeat refresh while pending')
    releaseHeldRead()
    await page.getByRole('alert').filter({ hasText: '暂时无法加载' }).waitFor()
    assert(await cards.count() === 3, 'failed refresh preserves previous data alongside the real failure')
    // The SDK may retry 503 responses itself; keep the fixture unavailable
    // until its request settles, then prove the explicit UI retry recovers.
    const failedReads = reads
    failReads = false
    await page.getByRole('button', { name: '重新加载', exact: true }).click()
    await expectCards(['回归米饭一', '回归米饭二', '回归面条'])
    assert(reads === failedReads + 1, 'retry performs one new fetch and restores actual fixture results')
    assert(unexpected.length === 0, 'all service traffic stayed inside the expected local fixture: ' + unexpected.join('; '))
    assert(errors.length === 0, 'no uncaught browser errors: ' + errors.join('; '))
    return { checks, fixtureOnly: true, initialListReads: baseline, finalListReads: reads }
  } catch (error) {
    throw new Error('Passed checks: ' + checks.join('; ') + '\nFailure: ' + error.message)
  } finally {
    releaseHeldRead()
    await page.evaluate(() => { window.__foodSearchFixture?.observer.disconnect(); delete window.__foodSearchFixture }).catch(() => {})
    await page.context().unroute('**/*', fixtureRoute)
    page.off('pageerror', onPageError)
  }
}
