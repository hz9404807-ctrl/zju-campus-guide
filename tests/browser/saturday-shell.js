// Local fixture only; no cloud credentials or business writes.
// Keep tests/browser/fixture/server.mjs running, then use playwright-cli run-code.
async browserPage => {
  const base = 'http://127.0.0.1:5182'
  const browser = browserPage.context().browser()
  const results = []
  const errors = []
  const check = (condition, label) => { results.push({ label, pass: Boolean(condition) }); if (!condition) throw Error(label) }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
    userAgent: 'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile' })
  await context.addInitScript(() => {
    Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined })
    Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  try {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(base)
      await page.getByRole('heading', { name: /办事有方法/ }).waitFor()
      check((await page.locator('#home-title').innerText()).replace(/\s/g, '') === '办事有方法，信息有方向，生活有去处。', `exact slogan ${width}`)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `home no overflow ${width}`)
      if (width === 390) await page.screenshot({ path: 'scratch/saturday-polish/home-390.png', fullPage: true })
      await page.getByRole('button', { name: '打开导航菜单' }).tap()
      await page.getByRole('navigation', { name: '手机主导航', exact: true }).getByRole('link', { name: '校园办事', exact: true }).tap()
      await page.waitForURL(base + '/guides')
      check(true, `Harmony UA menu guides ${width}`)
      for (const route of ['posts', 'ratings']) {
        await page.goto(`${base}/account/${route}?page=2`)
        await page.getByLabel('测试身份', { exact: true }).selectOption('guest')
        const login = page.getByRole('link', { name: /使用浙大邮箱登录/ })
        await login.waitFor()
        const returnTo = await login.evaluate(link => new URL(link.href).searchParams.get('returnTo'))
        check(returnTo === `/account/${route}?page=2`, `guest preserves subpage ${route} ${width}`)
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `guest subpage fits ${route} ${width}`)
      }
    }
    await page.goto(base)
    await page.route('**/__compat/slow', async route => {
      await page.waitForTimeout(120)
      await route.fulfill({ status: 200, body: 'late' }).catch(() => {})
    })
    const compat = await page.evaluate(async () => {
      const { createTimeoutFetch } = await import('/src/lib/timeoutFetch.ts')
      const request = createTimeoutFetch(40)
      const normal = await request('/__fixture/food.svg').then(response => response.ok)
      const timeout = await request('/__compat/slow').then(() => 'unexpected success', error => error.name)
      const parent = new AbortController(); parent.abort()
      const cancelled = await request('/__fixture/food.svg', { signal: parent.signal }).then(() => 'unexpected success', error => error.name)
      return { normal, timeout, cancelled, unavailable: typeof AbortSignal.any === 'undefined' && typeof AbortSignal.timeout === 'undefined' }
    })
    check(compat.unavailable && compat.normal, 'network succeeds without modern static AbortSignal APIs')
    check(compat.timeout === 'TimeoutError' && compat.cancelled === 'AbortError', 'legacy-capability timeout and cancellation remain effective')
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    try {
      const tab = await desktop.newPage()
      await tab.goto(base)
      await tab.getByRole('heading', { name: /办事有方法/ }).waitFor()
      check(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'desktop no overflow')
      await tab.screenshot({ path: 'scratch/saturday-polish/home-desktop.png', fullPage: true })
      await tab.getByRole('link', { name: '查找办事指南', exact: true }).focus()
      await tab.keyboard.press('Enter')
      await tab.waitForURL(base + '/guides')
      check(true, 'hero action works with keyboard')
    } finally { await desktop.close() }
    check(errors.length === 0, 'no uncaught application errors')
    return { fixtureOnly: true, harmonyUaOnly: true, checks: results.length, results, errors }
  } finally { await context.close() }
}
