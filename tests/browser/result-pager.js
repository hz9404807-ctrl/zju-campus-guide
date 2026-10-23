// Local isolated fixture only. Start tests/browser/fixture/server.mjs first.
// playwright-cli -s=result-pager --raw run-code --filename=tests/browser/result-pager.js
async browserPage => {
  const base = 'http://127.0.0.1:5182'
  const browser = browserPage.context().browser()
  const checks = []
  const errors = []
  const external = []
  const check = (condition, label) => { if (!condition) throw Error(label); checks.push(label) }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => {
    const url = route.request().url()
    if (url.startsWith(base + '/') || url.startsWith('data:')) return route.continue()
    external.push(url)
    return route.abort()
  })
  const pager = () => page.getByRole('navigation', { name: '结果分页', exact: true })
  async function focusedHeading(id) {
    await page.waitForFunction(id => document.activeElement?.id === id, id)
    const geometry = await page.locator('#' + id).evaluate(element => {
      const rect = element.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, header: document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0, height: innerHeight }
    })
    check(geometry.top >= geometry.header && geometry.bottom <= geometry.height, 'result heading stays focused below sticky header')
  }
  async function geometry(label, container) {
    const sizes = await container.locator('button').evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })))
    check(sizes.every(size => size.width >= 44 && size.height >= 44), label + ' has 44px touch targets')
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' has no document overflow')
    const bounds = await container.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return [...element.querySelectorAll('button')].every(button => { const target = button.getBoundingClientRect(); return target.left >= rect.left && target.right <= rect.right + .5 })
    })
    check(bounds, label + ' keeps all buttons inside navigation')
  }
  try {
    for (const width of [320, 375, 390, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 1000 : 844 })
      await page.goto(base + '/guides')
      await pager().waitFor()
      const last = await pager().locator('.result-pager__number').last().getAttribute('aria-label')
      const lastPage = Number(last.match(/\d+/)[0])
      check(lastPage >= 5 && await pager().locator('[aria-current="page"]').getAttribute('aria-label') === '第 1 页', width + ' guide pages expose current and last page')
      check(await pager().getByRole('button', { name: '上一页', exact: true }).isDisabled(), width + ' first boundary disables previous')
      await geometry(width + ' guide pager', pager())
      await pager().getByRole('button', { name: last, exact: true }).tap()
      await page.waitForURL(url => url.searchParams.get('page') === String(lastPage))
      await focusedHeading('guide-results-heading')
      check(await pager().getByRole('button', { name: '下一页', exact: true }).isDisabled(), width + ' last number jumps directly and disables next')
      await pager().getByRole('button', { name: '第 1 页', exact: true }).focus()
      await page.keyboard.press('Enter')
      await page.waitForURL(url => url.searchParams.get('page') === '1')
      await focusedHeading('guide-results-heading')
      await page.goto(base + '/account/ratings')
      await pager().waitFor()
      await pager().getByRole('button', { name: '第 3 页', exact: true }).tap()
      await page.waitForURL(url => url.searchParams.get('page') === '3')
      await focusedHeading('my-ratings-title')
      check(await page.locator('.account-rating').count() === 2, width + ' personal ratings retain six-record pagination and last-page remainder')
      await geometry(width + ' ratings pager', pager())

      // Exercise bounded large-page and disabled states without creating records.
      await page.evaluate(async () => (await import('/tests/browser/fixture/result-pager.tsx')).mountPager(100, 50, false))
      const standalone = page.locator('#standalone-pager-fixture')
      await standalone.getByRole('button', { name: '第 50 页', exact: true }).waitFor()
      check(await standalone.locator('.result-pager__pages').innerText() === '1\n…\n50\n…\n100', width + ' middle range collapses to five bounded slots')
      await geometry(width + ' middle pager', standalone.locator('nav'))
      await page.evaluate(async () => (await import('/tests/browser/fixture/result-pager.tsx')).mountPager(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 10, false))
      await standalone.getByRole('button', { name: `第 ${Number.MAX_SAFE_INTEGER - 10} 页`, exact: true }).waitFor()
      await geometry(width + ' huge pager', standalone.locator('nav'))
      await page.evaluate(async () => (await import('/tests/browser/fixture/result-pager.tsx')).mountPager(100, 50, true))
      await page.waitForFunction(() => [...document.querySelectorAll('#standalone-pager-fixture button')].every(button => button.disabled))
      check(await standalone.locator('button:disabled').count() === 5, width + ' pending action disables all page controls')
      if (width === 390 || width === 1280) {
        await page.goto(base + '/account/ratings?page=2')
        await pager().getByRole('button', { name: '第 2 页', exact: true }).waitFor()
        await pager().scrollIntoViewIfNeeded()
        await page.screenshot({ path: `scratch/result-pager-${width}.png`, animations: 'disabled' })
      }
    }
    check(external.length === 0, 'all traffic stays in loopback fixture')
    check(errors.length === 0, 'no uncaught browser errors')
    return { count: checks.length, checks, errors, external }
  } finally { await context.close() }
}
