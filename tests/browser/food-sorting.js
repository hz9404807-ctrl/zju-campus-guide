// Local in-memory display fixtures only. No real accounts, uploads or ratings.
async browserPage => {
  const base = 'http://127.0.0.1:5182'
  const unknownId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const zeroId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const highId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const tieId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const checks = [], errors = [], external = []
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label) }
  const context = await browserPage.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => {
    const url = route.request().url()
    if (url.startsWith(base + '/') || url.startsWith('data:')) return route.continue()
    external.push(url)
    return route.abort()
  })
  const card = id => page.locator(`.food-item-card[href^="/food/${id}"]`)
  const sortSelect = () => page.getByLabel('排序方式', { exact: true })
  const query = () => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)))
  async function settled() {
    await page.waitForFunction(() => !document.querySelector('.food-results-heading')?.textContent.includes('正在'))
    await page.locator('.food-item-card').first().waitFor()
  }
  async function list() {
    return page.locator('.food-item-card').evaluateAll(cards => cards.map(card => ({
      id: card.getAttribute('href').split('/food/')[1].split('?')[0],
      price: card.querySelector('.food-price').textContent.includes('价格待补充') ? null : Number(card.querySelector('.food-price').textContent.replace(/[^\d.]/g, '')),
      rating: card.querySelector('.food-rating-summary strong').textContent === '暂无评分' ? null : Number(card.querySelector('.food-rating-summary strong').textContent),
    })))
  }
  try {
    for (const width of [320, 375, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base + '/food')
      await settled()
      await page.getByLabel('测试身份', { exact: true }).selectOption('guest')
      await page.evaluate(async () => {
        const fixture = await import('/tests/browser/fixture/food-service.ts')
        fixture.setFixtureFood('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { price: null, average_rating: null, rating_count: 0 })
        fixture.setFixtureFood('cccccccc-cccc-4ccc-8ccc-cccccccccccc', { price: 0, average_rating: 2, rating_count: 3 })
        fixture.setFixtureFood('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { price: 25, average_rating: 5, rating_count: 1 })
        fixture.setFixtureFood('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { price: 10, average_rating: 2, rating_count: 9 })
      })
      await page.getByRole('button', { name: '刷新列表', exact: true }).click()
      await card(unknownId).getByText('价格待补充', { exact: true }).waitFor()
      await sortSelect().waitFor()
      check(await sortSelect().locator('option').count() === 5, `${width}: four directions plus default`)
      for (const value of ['price-asc', 'price-desc', 'rating-asc', 'rating-desc']) {
        await sortSelect().selectOption(value)
        const first = value === 'price-asc' ? zeroId : value === 'rating-asc' ? tieId : highId
        await page.waitForFunction(id => document.querySelector('.food-item-card')?.getAttribute('href').startsWith('/food/' + id), first)
        const rows = await list()
        check(rows.at(-1).id === unknownId, `${width} ${value}: unknown is last`)
        const key = value.startsWith('price') ? 'price' : 'rating'
        const known = rows.map(row => row[key]).filter(value => value !== null)
        const ascending = value.endsWith('-asc')
        check(known.every((value, index) => index === 0 || (ascending ? value >= known[index - 1] : value <= known[index - 1])), `${width} ${value}: actual numbers ordered`)
        check((await query()).sort === value, `${width} ${value}: share URL keeps direction`)
        if (key === 'rating') check(rows.findIndex(row => row.id === tieId) < rows.findIndex(row => row.id === zeroId), `${width} ${value}: equal scores prioritize rating count`)
      }
      check((await card(tieId).locator('.food-rating-count').innerText()).includes('9 人评分'), `${width}: score count remains visible`)
      await page.locator('#food-category').selectOption('测试')
      const place = (await page.locator('#food-location').locator('option').nth(1).getAttribute('value'))
      await page.locator('#food-location').selectOption(place)
      await page.getByLabel('想吃什么？', { exact: true }).fill('本地')
      await settled()
      check((await query()).sort === 'rating-desc' && (await query()).category === '测试' && (await query()).location === place, `${width}: combined filters keep sort`)
      await card(highId).click()
      await page.locator('.food-detail-content h1').waitFor()
      check((await query()).sort === 'rating-desc', `${width}: detail keeps sort`)
      await page.getByRole('link', { name: '返回美食列表', exact: true }).click()
      await sortSelect().waitFor()
      await settled()
      check(await sortSelect().inputValue() === 'rating-desc' && (await query()).q === '本地' && (await query()).location === place, `${width}: return restores combined state`)
      await page.reload()
      await settled()
      check(await sortSelect().inputValue() === 'rating-desc' && (await query()).category === '测试', `${width}: refresh restores shared URL`)
      await page.getByRole('button', { name: '清除筛选', exact: true }).click()
      await page.waitForURL(url => !url.searchParams.has('q') && !url.searchParams.has('category'))
      check((await query()).sort === 'rating-desc' && !(await query()).q && !(await query()).category, `${width}: clear filters preserves sorting`)
      await page.getByRole('button', { name: '校外美食', exact: true }).click()
      await page.getByRole('heading', { name: '没有找到符合条件的菜品', exact: true }).waitFor()
      check((await query()).sort === 'rating-desc' && await sortSelect().inputValue() === 'rating-desc', `${width}: area switch and empty state preserve sorting`)
      await page.getByRole('button', { name: '校内食堂', exact: true }).click()
      await settled()
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: controls and descriptions fit`)
      check((await sortSelect().boundingBox()).height >= 44, `${width}: sorting control has 44px height`)
      await sortSelect().focus()
      check(await sortSelect().evaluate(node => document.activeElement === node), `${width}: sorting control reachable by keyboard`)
      if (width === 390 || width === 1440) await page.screenshot({ path: `scratch/food-sorting-${width}.png`, fullPage: false })
      await sortSelect().selectOption('latest')
      await page.waitForURL(url => !url.searchParams.has('sort'))
      check(!(await query()).sort, `${width}: default removes explicit sort parameter`)
    }
    check(errors.length === 0, 'no uncaught application errors')
    check(external.length === 0, 'no external requests or cloud writes')
    return { passed: checks.length, checks, errors, external }
  } finally { await context.close() }
}
