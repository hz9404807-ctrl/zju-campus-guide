// Isolated local fixtures only. No credentials, real users or shared writes.
async browserPage => {
  const base = 'http://127.0.0.1:5182'
  const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const checks = [], errors = [], external = [], writes = []
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  const context = await browserPage.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => {
    const request = route.request(), url = request.url()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { writes.push({ url, method: request.method() }); return route.abort() }
    if (url.startsWith(base + '/') || url.startsWith('data:')) return route.continue()
    external.push(url)
    return route.abort()
  })
  const controls = () => page.locator('.food-rating-data-controls')
  const card = id => page.locator(`.food-item-card[href^="/food/${id}"]`)
  const query = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))
  const fixture = async next => page.evaluate(async state => { const f = await import('/tests/browser/fixture/food-service.ts'); f.setFixtureInitialRatings(state) }, next)
  async function ready(samples = true) {
    await page.locator('.food-item-card').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('.food-results-heading')?.textContent.includes('正在'))
    if (samples) await page.waitForFunction(() => !document.querySelector('.food-sample-status')
      && [...document.querySelectorAll('.food-item-card .food-rating-count')].every(node => Number(node.textContent.match(/\d+/)?.[0]) >= 15))
  }
  async function guest() { await page.getByLabel('测试身份', { exact: true }).selectOption('guest') }
  async function list() {
    return page.locator('.food-item-card').evaluateAll(cards => cards.map(node => ({
      id: node.getAttribute('href').split('/food/')[1].split('?')[0],
      average: Number(node.querySelector('.food-rating-summary strong').textContent),
      count: Number(node.querySelector('.food-rating-count').textContent.match(/\d+/)?.[0]),
      price: Number(node.querySelector('.food-price').textContent.replace(/[^\d.]/g, '')),
    })))
  }
  const summary = locator => locator.locator('.food-rating-summary').evaluate(node => ({
    average: Number(node.querySelector('strong').textContent), count: Number(node.querySelector('.food-rating-count').textContent.match(/\d+/)?.[0]),
  }))
  async function checkNoWrites(label) {
    const result = await page.evaluate(async () => (await import('/tests/browser/fixture/food-service.ts')).fixtureRatingSampleLog())
    check(result.ratingWriteAttempts === 0, label)
  }
  try {
    for (const width of [320, 375, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base + '/food')
      await ready(false)
      await guest()
      check((await summary(card(firstId))).average === 4 && (await summary(card(firstId))).count === 1, `${width}: real initial data stays 4/1`)
      check((await page.evaluate(async () => (await import('/tests/browser/fixture/food-service.ts')).fixtureRatingSampleLog())).initialRatingReads === 0, `${width}: default browsing skips sample request`)
      await controls().getByRole('button', { name: '体验评分样本', exact: true }).click()
      await ready()
      check((await query()).ratings === 'sample', `${width}: sample mode in URL`)
      check(await controls().getByText('评分样本', { exact: true }).isVisible(), `${width}: sample source is visible`)
      let rows = await list()
      check(rows.every(row => row.count >= 15 && row.count <= 100), `${width}: all counts 15-100`)
      check(rows.every(row => row.average >= 3 && row.average <= 5), `${width}: all averages based on initial four within +/-1`)
      const original = await summary(card(firstId))
      check((await card(firstId).locator('.food-rating-count').innerText()).includes('份评分样本'), `${width}: counts represent samples rather than people`)
      check(await page.locator('.food-item-card .food-rating-count').filter({ hasText: '人评分' }).count() === 0, `${width}: sample cards do not claim real participants`)

      for (const sort of ['price-asc', 'price-desc', 'rating-asc', 'rating-desc']) {
        await page.getByLabel('排序方式', { exact: true }).selectOption(sort)
        await page.waitForURL(url => url.searchParams.get('sort') === sort)
        const key = sort.startsWith('price') ? 'price' : 'average'
        const asc = sort.endsWith('-asc')
        await page.waitForFunction(({ key, asc }) => {
          const values = [...document.querySelectorAll('.food-item-card')].map(node => Number(node.querySelector(key === 'price' ? '.food-price' : '.food-rating-summary strong').textContent.replace(/[^\d.]/g, '')))
          return values.every((value, index) => index === 0 || (asc ? value >= values[index - 1] : value <= values[index - 1]))
        }, { key, asc })
        rows = await list()
        check(rows.every((row, index) => index === 0 || (asc ? row[key] >= rows[index - 1][key] : row[key] <= rows[index - 1][key])), `${width} ${sort}: displayed values sorted`)
        check((await query()).ratings === 'sample', `${width} ${sort}: sample mode retained`)
      }
      await page.locator('#food-category').selectOption('测试')
      const place = await page.locator('#food-location option').nth(1).getAttribute('value')
      await page.locator('#food-location').selectOption(place)
      await page.getByLabel('想吃什么？', { exact: true }).fill('本地')
      await ready()
      await card(firstId).click()
      await page.locator('.food-detail-content h1').waitFor()
      await page.waitForFunction(() => document.querySelector('.food-detail-rating .food-rating-count')?.textContent.includes('份评分样本')
        && Number(document.querySelector('.food-detail-rating .food-rating-count').textContent.match(/\d+/)?.[0]) >= 15)
      check(JSON.stringify(await summary(page.locator('.food-detail-rating'))) === JSON.stringify(original), `${width}: list and detail agree`)
      check(await page.getByRole('heading', { name: '当前查看评分样本', exact: true }).isVisible(), `${width}: sample details explain read-only context`)
      check(await page.locator('.food-rating-form').count() === 0 && await page.getByRole('link', { name: '登录后评分', exact: true }).count() === 0, `${width}: no live rating action inside samples`)
      await page.reload()
      await guest()
      await page.waitForFunction(() => Number(document.querySelector('.food-detail-rating .food-rating-count')?.textContent.match(/\d+/)?.[0]) >= 15)
      check(JSON.stringify(await summary(page.locator('.food-detail-rating'))) === JSON.stringify(original), `${width}: refresh preserves generated samples`)
      await page.getByRole('link', { name: '返回美食列表', exact: true }).click()
      await ready()
      check((await query()).ratings === 'sample' && (await query()).sort === 'rating-desc' && (await query()).q === '本地' && (await query()).location === place, `${width}: return preserves combined filters and mode`)
      await page.getByRole('button', { name: '清除筛选', exact: true }).click()
      await page.waitForURL(url => !url.searchParams.has('q'))
      check((await query()).ratings === 'sample' && (await query()).sort === 'rating-desc', `${width}: clear filters preserves mode and sorting`)
      await page.getByRole('button', { name: '校外美食', exact: true }).click()
      await page.getByRole('heading', { name: '没有找到符合条件的菜品', exact: true }).waitFor()
      check((await query()).ratings === 'sample', `${width}: scope switch preserves sample mode`)
      await page.getByRole('button', { name: '校内食堂', exact: true }).click()
      await ready()
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: sample controls fit viewport`)
      const button = controls().getByRole('button', { name: '查看真实评分', exact: true })
      await button.focus()
      check(await button.evaluate(node => document.activeElement === node), `${width}: mode control reachable by keyboard`)
      check((await button.boundingBox()).height >= 44, `${width}: mode button touch target`)
      if (width === 390 || width === 1280) await page.screenshot({ path: `scratch/rating-samples/list-${width}.png`, fullPage: false })
      if (width === 390) await card(firstId).screenshot({ path: 'scratch/rating-samples/card-390.png' })
      await button.click()
      await ready(false)
      check(!(await query()).ratings && (await summary(card(firstId))).average === 4 && (await summary(card(firstId))).count === 1, `${width}: closing mode restores actual 4/1`)
      await card(firstId).click()
      await page.getByRole('heading', { name: '给这道菜评分', exact: true }).waitFor()
      check(await page.getByRole('link', { name: '登录后评分', exact: true }).isVisible(), `${width}: actual email rating flow returns for guest`)
      await checkNoWrites(`${width}: no rating submission attempted`)
      await controls().getByRole('link', { name: '评分说明', exact: true }).click()
      await page.locator('#rating-data').waitFor()
      check(page.url().endsWith('/about#rating-data') && await page.locator('#rating-data').getByText(/随机生成的模拟评分/).isVisible(), `${width}: explanation points to explicit About disclosure`)
      check(await page.locator('#rating-data').evaluate(node => { const r = node.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 }), `${width}: hash link brings source explanation into view`)
      check(await page.locator('#rating-data').evaluate(node => document.activeElement === node), `${width}: About disclosure receives focus`)
      if (width === 390) await page.screenshot({ path: 'scratch/rating-samples/about-390.png', fullPage: false })
      await page.locator('#rating-data').getByRole('link', { name: '体验评分样本', exact: true }).click()
      await ready()
      check((await query()).ratings === 'sample', `${width}: About links back into sample browsing`)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(base + '/food')
    await ready(false)
    await guest()
    await fixture({ missingIds: [firstId] })
    await controls().getByRole('button', { name: '体验评分样本', exact: true }).click()
    await card(otherId).getByText(/份评分样本/).waitFor()
    await page.waitForFunction(() => Number(document.querySelector('.food-item-card[href*="bbbbbbbb"] .food-rating-count')?.textContent.match(/\d+/)?.[0]) >= 15)
    check(await card(firstId).getByText('暂无评分样本', { exact: true }).isVisible(), 'missing initial rating never guesses from real average')
    check((await summary(card(firstId))).count === 0, 'missing initial has zero generated samples')
    await controls().getByRole('button', { name: '查看真实评分', exact: true }).click()
    check((await summary(card(firstId))).average === 4 && (await summary(card(firstId))).count === 1, 'missing initial does not alter actual statistics')

    await fixture({ missingIds: [], failure: true, delay: 400 })
    await controls().getByRole('button', { name: '体验评分样本', exact: true }).click()
    await page.getByText('正在准备评分样本…', { exact: true }).waitFor()
    check(await card(firstId).getByText('暂无评分样本', { exact: true }).isVisible(), 'loading sample data does not show real values as generated data')
    await page.getByRole('button', { name: '重试评分样本', exact: true }).waitFor()
    check(await page.getByRole('alert').filter({ hasText: '初始评分读取失败' }).isVisible(), 'sample read failure has explicit feedback')
    check((await summary(card(firstId))).count === 0, 'failed sample read does not fabricate participants')
    await fixture({ failure: false, delay: 50 })
    await page.getByRole('button', { name: '重试评分样本', exact: true }).click()
    await ready()
    check((await summary(card(firstId))).count >= 15, 'sample failure can retry independently of public food read')
    await controls().getByRole('button', { name: '查看真实评分', exact: true }).click()
    await fixture({ failure: true, delay: 500 })
    await controls().getByRole('button', { name: '体验评分样本', exact: true }).click()
    await page.getByText('正在准备评分样本…', { exact: true }).waitFor()
    await controls().getByRole('button', { name: '查看真实评分', exact: true }).click()
    await page.waitForTimeout(650)
    check(!(await query()).ratings && (await summary(card(firstId))).average === 4 && (await summary(card(firstId))).count === 1, 'late failing sample response cannot replace actual values after closing mode')
    check(await page.getByRole('button', { name: '重试评分样本', exact: true }).count() === 0, 'closed sample mode does not leak stale errors')
    await fixture({ failure: false, delay: 50 })
    await page.evaluate(async () => (await import('/tests/browser/fixture/food-service.ts')).setFixtureFood('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { average_rating: 1, rating_count: 20 }))
    await page.getByRole('button', { name: '刷新列表', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.food-item-card[href*="bbbbbbbb"] .food-rating-summary strong')?.textContent === '1.0')
    await controls().getByRole('button', { name: '体验评分样本', exact: true }).click()
    await ready()
    check((await summary(card(otherId))).average >= 3, 'sample base is earliest initial rating, not a changed aggregate average')
    await controls().getByRole('button', { name: '查看真实评分', exact: true }).click()
    check((await summary(card(otherId))).average === 1 && (await summary(card(otherId))).count === 20, 'changed real aggregate remains intact after sample projection')
    await checkNoWrites('all failure and retry checks attempt zero rating writes')
    check(errors.length === 0, 'no uncaught application errors')
    check(external.length === 0, 'no external requests')
    check(writes.length === 0, 'no network writes or account creation')
    return { passed: checks.length, checks, errors, external, writes }
  } finally { await context.close() }
}
