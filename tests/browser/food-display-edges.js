// Isolated local display data only; never loads a real account or writes cloud content.
async browserPage => {
  const base = 'http://127.0.0.1:5182'
  const results = []
  const errors = []
  const check = (condition, label) => { results.push({ label, pass: Boolean(condition) }); if (!condition) throw Error(label) }
  const context = await browserPage.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  try {
    for (const width of [320, 375, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base + '/food')
      await page.locator('.food-item-card').first().waitFor()
      await page.getByLabel('测试身份', { exact: true }).selectOption('guest')
      await page.evaluate(async () => {
        const fixture = await import('/tests/browser/fixture/food-service.ts')
        fixture.setFixtureFood('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { price: null, name: 'Food'.repeat(20), location: 'CampusLocation'.repeat(8), average_rating: null, rating_count: 0 })
        fixture.setFixtureFood('cccccccc-cccc-4ccc-8ccc-cccccccccccc', { price: 0 })
      })
      await page.getByRole('button', { name: '刷新列表', exact: true }).click()
      const unknown = page.locator('.food-item-card[href^="/food/aaaaaaaa-"]')
      const zero = page.locator('.food-item-card[href^="/food/cccccccc-"]')
      await unknown.getByText('价格待补充', { exact: true }).waitFor()
      check(await unknown.getByText('暂无评分', { exact: true }).isVisible() && (await unknown.locator('.food-rating-count').innerText()).includes('0 人评分'), `unknown rating and count honest ${width}`)
      check((await zero.locator('.food-price').innerText()).trim() === '¥0.00', `zero price stays numeric ${width}`)
      check(!(await unknown.locator('.food-price').innerText()).includes('¥0'), `unknown price is never zero ${width}`)
      check(await unknown.locator('.food-price').evaluate(node => getComputedStyle(node).color === getComputedStyle(node.closest('.food-card-content').querySelector('.food-location')).color), `unknown list price uses secondary text style ${width}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `list long content fits ${width}`)
      await unknown.click()
      await page.locator('.food-detail-content h1').waitFor()
      check(await page.locator('.food-detail-price').innerText() === '价格待补充', `detail explicitly missing price ${width}`)
      check(await page.locator('.food-detail-price').evaluate(node => getComputedStyle(node).color === getComputedStyle(node.parentElement.querySelector('.food-location')).color), `unknown detail price uses secondary text style ${width}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `detail long name and location fit ${width}`)
      await page.getByRole('link', { name: '返回美食列表', exact: true }).click()
      await page.waitForURL(url => url.pathname === '/food')
      await unknown.getByText('价格待补充', { exact: true }).waitFor()
      check(await unknown.getByText('价格待补充', { exact: true }).isVisible(), `return keeps actual list ${width}`)
      if (width === 390) {
        await page.screenshot({ path: 'scratch/continued-polish/food-display-390.png', fullPage: true })
        await unknown.screenshot({ path: 'scratch/continued-polish/unknown-price-390.png' })
      }
    }
    check(errors.length === 0, 'no uncaught application errors')
    return { fixtureOnly: true, checks: results.length, results, errors }
  } finally { await context.close() }
}
