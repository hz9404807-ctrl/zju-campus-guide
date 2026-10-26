// Local fixtures + fixed workbook samples. No real identities or shared writes.
async browserPage => {
  const base = 'http://127.0.0.1:5182'
  const firstId = '335f9643-764c-4ce4-96d8-8d5f1f349e11'
  const secondId = 'da41234b-8ba3-4548-984d-a28577f0faa2'
  const missingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const checks = [], errors = [], external = [], writes = []
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  const context = await browserPage.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => {
    const request = route.request(), url = request.url()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { writes.push(request.method()); return route.abort() }
    if (url.startsWith(base + '/') || url.startsWith('data:')) return route.continue()
    external.push(url)
    return route.abort()
  })
  const controls = () => page.locator('.food-rating-data-controls')
  const card = id => page.locator(`.food-item-card[href^="/food/${id}"]`)
  const query = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))
  const summary = locator => locator.locator('.food-rating-summary').evaluate(node => ({ average: Number(node.querySelector('strong').textContent), count: Number(node.querySelector('.food-rating-count').textContent.match(/\d+/)?.[0]) }))
  async function ready() {
    await card(firstId).waitFor()
    await page.waitForFunction(() => !document.querySelector('.food-results-heading')?.textContent.includes('正在'))
  }
  async function fixedValues() {
    const a = await summary(card(firstId)), b = await summary(card(secondId))
    return a.count === 29 && a.average === 4 && b.count === 69 && b.average === 4.6
  }
  try {
    for (const width of [320, 375, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base + '/food?__rating_fixture=fixed')
      await ready()
      await page.getByLabel('测试身份', { exact: true }).selectOption('guest')
      check((await summary(card(firstId))).average === 4 && (await summary(card(firstId))).count === 1, `${width}: default actual rating is unchanged 4/1`)
      await controls().getByRole('button', { name: '体验评分样本', exact: true }).click()
      await page.waitForURL(url => url.searchParams.get('ratings') === 'sample')
      check(await fixedValues(), `${width}: workbook exact values 4.0/29 and 4.6/69`)
      check(await card(missingId).getByText('暂无评分样本', { exact: true }).isVisible() && (await summary(card(missingId))).count === 0, `${width}: absent workbook ID stays empty rather than generating samples`)
      check((await card(firstId).locator('.food-rating-count').innerText()).includes('份评分样本'), `${width}: counts describe samples`)
      check(await page.locator('.food-sample-status').count() === 0, `${width}: fixed snapshot needs no asynchronous initial-rating request`)
      await page.getByLabel('排序方式', { exact: true }).selectOption('rating-desc')
      await page.waitForFunction(id => document.querySelector('.food-item-card')?.getAttribute('href').startsWith('/food/' + id), secondId)
      check(await fixedValues() && (await query()).ratings === 'sample', `${width}: displayed fixed samples drive sorting`)
      await page.getByLabel('想吃什么？', { exact: true }).fill('本地')
      await page.locator('#food-category').selectOption('测试')
      await card(firstId).click()
      await page.locator('.food-detail-content h1').waitFor()
      const detail = await summary(page.locator('.food-detail-rating'))
      check(detail.average === 4 && detail.count === 29, `${width}: detail uses same fixed workbook sample`)
      check(await page.getByRole('heading', { name: '当前查看评分样本', exact: true }).isVisible() && await page.locator('.food-rating-form').count() === 0, `${width}: sample detail cannot submit live ratings`)
      await page.reload()
      await page.getByLabel('测试身份', { exact: true }).selectOption('guest')
      await page.locator('.food-detail-content h1').waitFor()
      check(JSON.stringify(await summary(page.locator('.food-detail-rating'))) === JSON.stringify(detail), `${width}: refresh preserves exact workbook values`)
      await page.getByRole('link', { name: '返回美食列表', exact: true }).click()
      await ready()
      check((await query()).ratings === 'sample' && (await query()).sort === 'rating-desc' && (await query()).q === '本地' && (await query()).category === '测试', `${width}: return preserves combined filters and sample mode`)
      await page.getByRole('button', { name: '清除筛选', exact: true }).click()
      await page.waitForURL(url => !url.searchParams.has('q'))
      check((await query()).ratings === 'sample' && (await query()).sort === 'rating-desc', `${width}: clear filters preserves mode and sort`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: controls and fixed sample cards fit viewport`)
      if (width === 390 || width === 1280) await page.screenshot({ path: `scratch/rating-samples/list-${width}.png`, fullPage: false })
      if (width === 390) await card(firstId).screenshot({ path: 'scratch/rating-samples/card-390.png' })
      await controls().getByRole('button', { name: '查看真实评分', exact: true }).click()
      check(!(await query()).ratings && (await summary(card(firstId))).average === 4 && (await summary(card(firstId))).count === 1 && (await summary(card(secondId))).count === 1, `${width}: close immediately restores actual 4/1 values`)
      const log = await page.evaluate(async () => (await import('/tests/browser/fixture/food-service.ts')).fixtureRatingSampleLog())
      check(log.initialRatingReads === 0 && log.ratingWriteAttempts === 0, `${width}: zero initial-rating reads and zero rating writes`)
      await controls().getByRole('link', { name: '评分说明', exact: true }).click()
      const source = page.locator('#rating-data')
      await source.waitFor()
      check((await source.innerText()).includes('“评分样本”为导入的模拟数据，用于Demo展示；真实评价独立保留。'), `${width}: concise source disclosure states imported simulated data`)
      check(await source.evaluate(node => { const title = node.querySelector('h2').getBoundingClientRect(), header = document.querySelector('.site-header').getBoundingClientRect(); return title.top >= header.bottom && title.bottom <= innerHeight && document.activeElement === node }), `${width}: source hash has visible focused heading`)
      const entry = source.getByRole('link', { name: '体验评分样本', exact: true })
      check((await entry.boundingBox()).height >= 44, `${width}: source entry touch target`)
      if (width === 390) await page.screenshot({ path: 'scratch/rating-samples/about-390.png', fullPage: false })
      await entry.click()
      await ready()
      check(await fixedValues() && (await query()).ratings === 'sample', `${width}: About entry returns to same fixed sample snapshot`)
    }
    check(errors.length === 0, 'no uncaught application errors')
    check(external.length === 0, 'no external requests')
    check(writes.length === 0, 'no network writes or account creation')
    return { passed: checks.length, checks, errors, external, writes }
  } finally { await context.close() }
}
